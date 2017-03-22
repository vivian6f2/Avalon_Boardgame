//----------------------------------------------------------------------//
//public information for avalon game
var player_data = []; //player list
var set_name = false;
var join_game = false;
var player_id = null;
var player_role = null;
var room_owner_id = null;


var leader_id = null;
var leader_name = null;
var team_size = null;
var team_members = [];
var two_fail = false;

//characters set
var max_good = 0;
var max_evil = 0;
var good_characters = [];
var evil_characters = [];

//game states
var states = ["wait", "randomCharacters", "sendMission", "vote", "mission",
    "missionSuccess", "missionFail", "update", "findMerlin", "badWin", "goodwin"];

//UI
var content_height = 0;

//----------------------------------------------------------------------//

$(function() { //$(document).ready(function() { ... }); it means that when document ready, run the function
    var content = $('#content'); //like document.getelementbyid
    var status = $('#status');
    var input = $('#input');
    var playerList = $('#playerList');
    var stateDisplay = $('#stateDisplay');
    var myName = false;

    //建立websocket连接
    socket = io.connect('http://localhost:3000');
    //收到server的连接确认
    socket.on('open', function() { //socket.emit('open')
        //$('.allStates').css('display','initial');
        //status.text('Choose a name:');
        $('#connectStatus').text('Choose a name:');
        //for(i=0;i<9;i++) content.append('<p style="height:18px;padding:0px;"></p>');
    });



    //----------------------------------------------------------------------//
    //gameplay programming here!
    //--------------All states are different--------------//
    //监听system事件，判断welcome或者disconnect，打印系统消息信息
    socket.on('system', function(json) {
        var p = '';
        switch (json.state) {
            case "wait":
                if (json.type === 'welcome') {
                    //new player login
                    if (myName == json.text) status.text(myName + ': ').css('color', json.color);
                    p = '<p style="background:' + json.color + '">system  @ ' + json.time + ' : Welcome ' + json.text + '</p>';
                } else if (json.type == 'full') {
                    //the server is full
                    window.alert(json.text);
                    set_name = false;
                    myName = false;
                    join_game = false;
                } else if (json.type == 'ready' && join_game) {
                    //show the ready button
                    $('.wait #readyButton').css('display', 'initial');
                } else if (json.type == 'hideReady' && join_game) {
                    //hide the ready button
                    $('.wait #readyButton').css('display', 'none');
                    $('.wait #readyButton').html('ready');
                } else if (json.type == 'allReady' && join_game) {
                    //all ready, show the play button for room owner
                    if (room_owner_id == player_id && json.value) {
                        $('.wait #playButton').css('display', 'initial');
                        $('.wait #playButton').html('play');
                    } else {
                        $('.wait #playButton').css('display', 'none');
                        $('.wait #playButton').html('play');
                    }
                } else if (json.type == 'join') {
                    //known this player is joined, add needed value

                    $('.allStates').css('display', 'initial');
                    $('.setName').css('display', 'none');
                    $('.displayChat').css('display', 'inline-block');
                    $('#gameInformArea').css('display','inline-block');
                    $('#gameArea').css('display','inline-block');

                    join_game = json.value;
                    player_id = json.player_id;
                    room_owner_id = json.room_owner_id;
                }
                break;
            case "randomCharacters":
                $('.randomCharacters').css('display', 'none');
                if (json.type == 'chooseCharactersSet') {
                    //alert(room_owner_id + " " + player_id);
                    //show choose character form for room owner
                    if (room_owner_id == player_id) {
                        $('.randomCharacters').css('display', 'initial');
                        $('.randomCharacters #charactersInformation').html('There are ' + json.good + ' good and ' + json.evil + ' evil.<br>Choose characters you want to add:');

                        max_good = json.good;
                        max_evil = json.evil;
                        updateCharactersSet();
                    } else {
                        $('.randomCharacters').css('display', 'none');
                    }
                }
                break;
            case "sendMission":
                if (json.type == 'setLeader') {
                    //set leader and if this player is leader, show choose members form
                    $('.gameDetails').css('display', 'initial');
                    leader_id = json.leader_id;
                    team_size = json.team_size;
                    $('#turn').html('Round ' + (json.turn + 1));
                    $('#vote_turn').html('Vote ' + (json.vote_turn) + ' times');
                    if (json.two_fail && json.turn == 3) {
                        $('#two_fail').html("Need two fail this time");
                    } else {
                        $('#two_fail').html("");
                    }

                    if (player_id == leader_id) {
                        sendMissionForm();
                    } else {
                        //$('.sendMission').html('');
                        $('.sendMission').css('display','none');
                    }
                }
                break;
            case "vote":
                if (json.type == 'vote') {
                    //show team members and vote form
                    team_members = json.team_members;
                    voteForm();
                }
                break;
            case "mission":
                if (json.type == 'vote') {
                    //check if this player is in the team members, show success and fail button
                    team_members = json.team_members;
                    $('.mission').css('display', 'initial');
                    var to_vote = false;
                    var inner_span = "<span>Team members are:</span><br>";
                    //inner_span += player_id + "<br>";
                    for (i = 0; i < team_members.length; i++) {
                        inner_span += "<span>" + team_members[i][1] + " (" + team_members[i][0] + ")<span><br>";
                        if (team_members[i][0] == player_id) {
                            //inner_span += "<span>You have to vote</span><br>";
                            to_vote = true;
                        }
                    }
                    if (to_vote) {
                        inner_span += "<button id='successButton'>success</button>&nbsp;&nbsp;";
                        inner_span += "<button id='failButton'>fail</button>";
                    }
                    $('.mission').html(inner_span);
                }
                break;
            case "missionSuccess":
                if (json.type == 'update') {
                    //update game detail
                    $('.update').css('display', 'initial');
                    var inner_span = "<span>Mission success</span><br>";
                    $('.update').html(inner_span);
                    $('#success_time').html("Success : " + json.detail[2]);
                    $('#fail_time').html("Fail : " + json.detail[3]);
                    $('#lastMissionResult').html('Last mission: ' + json.detail[0] + ' success,' + json.detail[1] + ' fail');
                }
                break;
            case "missionFail":
                if (json.type == 'update') {
                    //update game detail
                    $('.update').css('display', 'initial');
                    var inner_span = "<span>Mission fail</span><br>";
                    inner_span += json.detail[0] + " success " + json.detail[1] + " fail";
                    $('.update').html(inner_span);
                    $('#success_time').html("Success : " + json.detail[2]);
                    $('#fail_time').html("Fail : " + json.detail[3]);
                    $('#lastMissionResult').html('Last mission: ' + json.detail[0] + ' success,' + json.detail[1] + ' fail');
                }

                break;
            case "update":
                break;
            case "findMerlin":
                if (json.type == 'kill') {
                    //check if this player is assassin, show find merlin form
                    var is_assassin = false;
                    for (i = 0; i < player_data.length; i++) {
                        if (player_data[i].id == player_id && player_data[i].role[0] == 'Assassin') {
                            is_assassin = true;
                        }
                    }
                    if (is_assassin) {
                        findMerlinForm(json.kill_list);
                    }
                }
                break;
            case "evilWin":
                if (json.type == 'endGame') {
                    //show last game winner
                    $('#lastGameWinner').html('Evil Wins!');

                }
                break;
            case "goodWin":
                if (json.type == 'endGame') {
                    //show last game winner
                    $('#lastGameWinner').html('Good Wins!');

                }
                break;
            default:
                break;
        }
        //--------------All states are different--------------//

        //--------------All states are same--------------//
        if (json.type == 'disconnect') {
            if (json.text != false) {
                p = '<p style="background:' + json.color + '">system  @ ' + json.time + ' : Bye ' + json.text + '</p>';
            }

        } else if (json.type == 'playerList') {
            //update player list
            inner_li = '';
            playerList.html('');
            //update room owner
            room_owner_id = json.room_owner_id;

            //find players role and leaders name
            for (i = 0; i < json.playerData.length; i++) {
                if (json.playerData[i].id == player_id) player_role = json.playerData[i].role;
                if (leader_id != null && leader_id == json.playerData[i].id) leader_name = json.playerData[i].name;
            }
            if (player_role != null) {
                $('#playerRole').html('You are ' + player_role[0] + ' (' + player_role[1] + ')!');
            } else {
                $('#playerRole').html('');
            }

            //show leader
            if (leader_id != null) {
                $('#leader').html('The leader is ' + leader_name + ' (' + leader_id + ')');
            } else {
                $('#leader').html('');
            }

            if (room_owner_id == null) {
                $('#roomOwner').html('');
            }
            for (i = 0; i < json.playerData.length; i++) {
                if (json.playerData[i].id == room_owner_id) {
                    $('#roomOwner').html('Room owner: ' + json.playerData[i].name + ' (' + json.playerData[i].id + ')');
                }
                if (json.playerData[i].id == player_id) inner_li += '<tr style="font-weight:bold;color:' + json.playerData[i].color + ';">';
                else inner_li += '<tr style="color:' + json.playerData[i].color + ';">';

                inner_li += '<td style="width:20px;">';
                if (player_role != null) {
                    if (player_role[0] == 'Merlin') {
                        if (json.playerData[i].role[1] == 'Evil' && json.playerData[i].role[0] != 'Mordred') {
                            inner_li += 'Evil ';
                        }
                    } else if (player_role[0] == 'Percival') {
                        if (json.playerData[i].role[0] == 'Merlin' || json.playerData[i].role[0] == 'Morgana') {
                            inner_li += 'Merlin ';
                        }
                    } else if (player_role[1] == 'Evil') {
                        if (json.playerData[i].role[1] == 'Evil' && json.playerData[i].role[0] != 'Oberon') {
                            inner_li += 'Evil ';
                        }
                    }
                    if (player_role[0] == 'Oberon') {
                        if (json.playerData[i].id == player_id) {
                            inner_li += 'Evil ';
                        }
                    }
                }
                inner_li += '</td>';

                inner_li += '<td style="width:5px;">' + json.playerData[i].id + '</td><td style="width:80px;">' + json.playerData[i].name + '</td>';

                inner_li += '<td style="width:10px;">';
                if (json.playerData[i].vote == true) {
                    inner_li += " agree";
                } else if (json.playerData[i].vote == false) {
                    inner_li += " disagree";
                }
                if (json.playerData[i].ready) inner_li += ' ready';
                inner_li += '</td>';
                inner_li += '</tr>';
            }
            playerList.html(inner_li);
            player_data = json.playerData;
            updateBoard();

        } else if (json.type == 'changeState') {
            //update state
            stateDisplay.html('state : ' + json.state);
            for (i = 0; i < states.length; i++) {
                if (states[i] != json.state) {
                    $("." + states[i]).css('display', 'none');
                }
            }
            $("." + json.state).css('display', 'initial');
            if (json.state == "wait") init();
        }

        if (p != '') content_height += 20;
        content.append(p);
        content.scrollTop(content_height); //auto scroll to bottom
    });
    //--------------Function to use here--------------//
    //--------------All states--------------//
    var init = function() {
        for (i = 0; i < states.length; i++) {
            $("." + states[i]).css('display', 'none');
        }
        $('.wait').css('display', 'initial');

        //gameDetails
        $('.gameDetails').css('display', 'none');
        $('#playerRole').html("");
        $('#leader').html("");
        $('#turn').html("");
        $('#vote_turn').html("");
        $('#team_size').html("");
        $('#two_fail').html("");
        $('#success_time').html("");
        $('#fail_time').html("");
        $('#lastMissionResult').html('');
        leader_id = null;
        player_role = null;

        //wait
        $('.wait #playButton').html("play");
        $('.wait #readyButton').html("ready");

        //randomCharacters
        $('.randomCharacters #Merlin').attr('checked', true);
        $('.randomCharacters #Percival').attr('checked', false);
        $('.randomCharacters #Morgana').attr('checked', false);
        $('.randomCharacters #Assassin').attr('checked', true);
        $('.randomCharacters #Mordred').attr('checked', false);
        $('.randomCharacters #Oberon').attr('checked', false);


    };
    var updateBoard = function(){
        //update board with client theirselves show on the middle of tabledown
        if(player_id!=null){
            //create show list
            $('#gameTableUp').html('');
            $('#gameTableDown').html('');
            var show_list = rotateArray(player_id);
            //show on the board
            var change_index = Math.ceil(show_list.length/2);
            //alert(change_index);
            for(i=0;i<show_list.length;i++){
                var inner_html = '<td>';
                inner_html += '<span>';
                if(player_role!=null){
                    if(player_id!=show_list[i].id){
                        if(player_role[0]=='Merlin'){
                            if(show_list[i].role[1]=='Evil'&&show_list[i].role[0]!='Mordred'){
                                inner_html += 'Evil';
                            }

                        }else if(player_role[0]=='Percival'){
                            if(show_list[i].role[0]=='Merlin'||show_list[i].role[0]=='Morgana'){
                                inner_html += 'Merlin';
                            }

                        }else if(player_role[1]=='Evil'){
                            if(show_list[i].role[1]=='Evil'&&show_list[i].role[0]!='Oberon'){
                                inner_html += 'Evil';
                            }

                        }
                    }
                    if(player_id==show_list[i].id){
                        //yourself
                        inner_html += show_list[i].role[0]+' ('+show_list[i].role[1]+')';

                    }
                }
                inner_html += '</span><br>';
                inner_html += '<span style="color:'+show_list[i].color+';">'+show_list[i].name+' ('+show_list[i].id+')'+'</span><br>';
                
                inner_html += "<div class='sendMission' style='//display:initial;'><input type='checkbox' id='member_" + show_list[i].id + "' value='" + show_list[i].id + "' class='member_check'>";
                inner_html += "</div><br>";
                inner_html += '</td>';
                if(i>=change_index){
                    //table up
                    $('#gameTableUp').prepend(inner_html);
                }else{
                    //table down
                    $('#gameTableDown').append(inner_html);
                }
            }
        }
    };
    var rotateArray = function(id){
        show_list = player_data;
        //window.alert(player_id);
        while(show_list[0].id!=player_id){
            //window.alert(show_list[0].id);
            var one_player_data = show_list.shift();
            show_list.push(one_player_data);
        }
        if(player_data.length>=5){
            //rotate back one time
            var one_player_data = show_list.pop();
            show_list.unshift(one_player_data);
        }
        if(player_data.length>=9){
            //rotate back one time
            var one_player_data = show_list.pop();
            show_list.unshift(one_player_data);
        }
        return show_list;

    }

    //--------------All states--------------//
    //--------------randomCharacters states--------------//
    var updateCharactersSet = function() {
        $('.randomCharacters').css('display', 'initial');
        good_characters = [];
        evil_characters = [];
        if ($('.randomCharacters #Merlin').is(":checked")) good_characters.push("Merlin");
        if ($('.randomCharacters #Percival').is(":checked")) good_characters.push("Percival");
        if ($('.randomCharacters #Morgana').is(":checked")) evil_characters.push("Morgana");
        if ($('.randomCharacters #Assassin').is(":checked")) evil_characters.push("Assassin");
        if ($('.randomCharacters #Mordred').is(":checked")) evil_characters.push("Mordred");
        if ($('.randomCharacters #Oberon').is(":checked")) evil_characters.push("Oberon");

    };
    //--------------randomCharacters states--------------//
    //--------------sendMission states--------------//
    var sendMissionForm = function() {
        $('.sendMission').css('display', 'initial');
        $('.member_check').css('display','initial');
        //alert($('.member_check').val());
        //$('.sendMission .member_check').css('display','initial');
        var inner_input = "<span>Choose the team: (team size is " + team_size + ")</span><br>";
        /*for (i = 0; i < player_data.length; i++) {
            inner_input += "<input type='checkbox' id='member_" + player_data[i].id + "' value='" + player_data[i].id + "' class='member_check'>";
            inner_input += "<label for='member_" + player_data[i].id + "'>" + player_data[i].name + " (" + player_data[i].id + ")</label><br>";
        }
        inner_input += "<button id='memberDoneButton'>Done</button>";*/
        $('#sendMissionInform').html(inner_input);
    };
    var updateTeamMembers = function() {
        team_members = [];
        for (i = 0; i < player_data.length; i++) {
            if ($('.sendMission #member_' + player_data[i].id).is(":checked")) team_members.push([player_data[i].id, player_data[i].name]);
        }
    };
    //--------------sendMission states--------------//
    //--------------vote states--------------//
    var voteForm = function() {
        $('.vote').css('display', 'initial');
        var inner_span = "<span>Team members are:</span><br>";
        for (i = 0; i < team_members.length; i++) {
            inner_span += "<span>" + team_members[i][1] + " (" + team_members[i][0] + ")<span><br>";
        }
        inner_span += "<button id='voteAgreeButton'>agree</button>&nbsp;&nbsp;";
        inner_span += "<button id='voteDisagreeButton'>disagree</button>";
        $('.vote').html(inner_span);
    };
    //--------------vote states--------------//
    //--------------findMerlin states--------------//
    var findMerlinForm = function(kill_list) {
        $('.findMerlin').css('display', 'initial');
        var inner_input = "<span>Find merlin:</span><br>";
        inner_input += "<select id='selectMerlin'>";
        for (i = 0; i < kill_list.length; i++) {
            inner_input += "<option value='" + kill_list[i][0] + "'>" + kill_list[i][1] + " (" + kill_list[i][0] + ")</option>";
        }
        inner_input += "</select><br>";
        inner_input += "<button id='findButton'>done</button><br>";
        $('.findMerlin').html(inner_input);
    };
    //--------------findMerlin states--------------//

    //--------------Function to use here--------------//


    //监听message事件，打印消息信息
    socket.on('message', function(json) {
        var p = '<p><span style="color:' + json.color + ';">' + json.author + '</span> @ ' + json.time + ' : ' + json.text + '</p>';
        content_height += 20;
        content.append(p);
        content.scrollTop(content_height); //auto scroll to bottom
    });

    //----------------------------------------------------------------------//
    //--------------Button or Input or Form or Others--------------//
    //--------------findMerlin state--------------//
    $('.findMerlin').on('click', '#findButton', function() {
        //alert('click');
        $('.findMerlin').css('display', 'none');
        var obj = { type: 'find' };
        obj['value'] = $('#selectMerlin').val();
        socket.emit('player', obj); //state = findMerlin
    });
    //--------------findMerlin state--------------//
    //--------------mission state--------------//
    $('.mission').on('click', '#successButton', function() {
        $('.mission #successButton').css('display', 'none');
        $('.mission #failButton').css('display', 'none');
        var obj = { type: 'vote', value: true };
        socket.emit('player', obj); //state = mission
    });

    $('.mission').on('click', '#failButton', function() {
        $('.mission #successButton').css('display', 'none');
        $('.mission #failButton').css('display', 'none');
        var obj = { type: 'vote', value: false };
        socket.emit('player', obj); //state = mission
    });

    //--------------mission state--------------//
    //--------------vote state--------------//
    $('.vote').on('click', '#voteAgreeButton', function() {
        $('.vote').css('display', 'none');
        var obj = { type: 'vote', value: true };
        socket.emit('player', obj); //state = vote
    });

    $('.vote').on('click', '#voteDisagreeButton', function() {
        $('.vote').css('display', 'none');
        var obj = { type: 'vote', value: false };
        socket.emit('player', obj); //state = vote

    });
    //--------------vote state--------------//
    //--------------sendMission state--------------//
    $('#gameArea').on('click', '.member_check', function() {
        //window.alert('checked!!');
        if ($('.sendMission .member_check:checked').length > team_size) {
            window.alert('You can only choose ' + team_size + ' team members');
            $(this).attr('checked', false);
        }else if($('.sendMission .member_check:checked').length == team_size){
            var inner_input = "<br><button id='memberDoneButton'>Done</button>";
            $('#sendMissionInform').append(inner_input);
        }else{
            var inner_input = "<span>Choose the team: (team size is " + team_size + ")</span><br>";
            $('#sendMissionInform').html(inner_input);
        }
        updateTeamMembers();
    });
    $('.sendMission').on('click', '#memberDoneButton', function() {
            if ($('.sendMission .member_check:checked').length < team_size) {
                window.alert("You have to choose " + team_size + ' team members');
            } else if ($('.sendMission .member_check:checked').length == team_size) {
                $('.sendMission').css('display', 'none');
                var obj = { type: 'ready' };
                obj['team_members'] = team_members;
                socket.emit('player', obj); //state = sendMission
            }
        })
        //--------------sendMission state--------------//
        //--------------randomCharacters state--------------//
    $('.randomCharacters .good_check').click(function() {
        if ($(this).val() == 'Merlin' && !$(this).is(":checked")) {
            window.alert('Merlin should always be included');
            $(this).attr('checked', true);
        }
        if ($('.randomCharacters .good_check:checked').length > max_good) {
            window.alert('You can only choose ' + max_good + ' good characters');
            $(this).attr('checked', false);
        }
        updateCharactersSet();
    });
    $('.randomCharacters .evil_check').click(function() {
        if ($(this).val() == 'Assassin' && !$(this).is(":checked")) {
            window.alert('Assassin should always be included');
            $(this).attr('checked', true);
        }
        if ($('.randomCharacters .evil_check:checked').length > max_evil) {
            window.alert('You can only choose ' + max_evil + ' evil characters');
            $(this).attr('checked', false);
        }
        updateCharactersSet();
    });
    $('.randomCharacters #charactersDoneButton').click(function() {
        //window.alert('clicked');
        var obj = { type: 'ready' };
        obj['good_characters'] = good_characters;
        obj['evil_characters'] = evil_characters;
        socket.emit('player', obj); //state = randomCharacters
    });
    //--------------randomCharacters state--------------//


    //--------------wait state--------------//
    $('.wait #playButton').click(function() {
        if ($('.wait #playButton').html() == 'play') {
            $('.wait #playButton').html('not yet');
            socket.emit('player', { type: 'playButton' }); //state = wait
        } else if ($('.wait #playButton').html() == 'not yet') {
            $('.wait #playButton').html('play');
        }
    });

    $('.wait #readyButton').click(function() {
        if ($('.wait #readyButton').html() == 'ready') {
            $('.wait #readyButton').html('not yet');
            socket.emit('player', { value: true, type: 'readyButton' }); //state = wait
        } else if ($('.wait #readyButton').html() == 'not yet') {
            $('.wait #readyButton').html('ready');
            socket.emit('player', { value: false, type: 'readyButton' }); //state = wait
        }

    });
    //--------------wait state--------------//

    //通过“回车”提交聊天信息
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) return;
            socket.emit('message', msg);
            $(this).val('');
        }
    });
    $('#nameInput').keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) return;
            if (!set_name) {
                socket.emit('player', { name: msg, type: 'setName' });
                set_name = true;
            }
            $(this).val('');
            if (myName === false) {
                myName = msg;
            }
        }
    });

});
//--------------Button or Input or Others--------------//
//--------------All states are same--------------//
//----------------------------------------------------------------------
