//----------------------------------------------------------------------//
//public information for avalon game
//game states
var states = ["wait","randomCharacters","sendMission","vote","mission",
  "missionSuccess","missionFail","update","findMerlin","evilWin","goodWin"]; //all states needed
var good_evil_count = [[3,2],[4,2],[4,3],[5,3],[6,3],[6,4]]; //rule
var team_assignment = [[[2,3,2,3,3],false],[[2,3,4,3,4],false],[[2,3,3,4,4],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true]]; //rule

//for debug
var show_emit = false;

var room_list = {}; //key & room class
var room_id = 0; //for creating unique room id


//----------------------------------------------------------------------//


//----------------------------------------------------------------------//
//引入程序包
var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

//设置日志级别
io.set('log level', 1); 
//----------------------------------------------------------------------//



//----------------------------------------------------------------------//
//gameplay programming here!!
//WebSocket连接监听
io.on('connection', function (socket) {
  if(show_emit) console.log('emit socket open (one client)');
  //console.log(room_list);
  socket.emit('open',{room_list:room_list,room_id:null});//通知客户端已连接 //只傳給一個
  // 打印握手信息
  // console.log(socket.handshake);

  // 构造客户端对象
  var client = {
    socket:socket,
    name:false,
    color:getColor(),
    id:null, //same as player_data[index]['id']
    room_id:null
  };

//--------------All states are different--------------//
  socket.on('createRoom', function(json){
    console.log('create new room');
    var room = {
      //room class
      room_name : "",
      //game options
      //game necessary count / set
      turn : 0, //mission turn
      success_time : 0, //total success time
      fail_time : 0, //total fail time
      vote_turn : 0, //voting turn
      vote_success : 0, //number of agreement
      vote_fail : 0, //number of disagreement
      
      //for characters setting
      max_good : 0, //maximum number of good characters
      max_evil : 0, //maximum number of evil characters
      good_characters : [], //all good characters 
      evil_characters : [], //all evil characters
      all_characters : [], //all characters
      
      //for mission sending (number of ppl of team & the 4th mission need 2 fail or not)
      team_members : [], //team members to do the mission
      
      state : states[0], //initial states
      
      //player information
      player_data : [], //id, name, role[special character, evil/good], ready, color, teammembers
      player_id : 0, //for creating unique id
      room_owner_id : null, //room owner
      leader_id : null //leader to choose members
    };
    room_list[room_id]=room;
    socket.emit('open',{room_list:room_list,room_id:room_id, room_name:json.name});//通知客户端已连接 //只傳給一個
    client.room_id=room_id;
    room_list[room_id].room_name = json.name;
    console.log(room_list[room_id]);
    room_id++;
    socket.broadcast.emit('updateRoom',{room_list:room_list});
  });
  socket.on('joinRoom', function(json){
    console.log('join room '+json.room_id);
    client.room_id=json.room_id;
    socket.emit('open',{room_list:room_list,room_id:client.room_id, room_name:room_list[json.room_id].room_name});//通知客户端已连接 //只傳給一個
    
  });

  socket.on('player', function(json){
    if(client.room_id==null){
      console.log("this client is still not in any room!");
    }else if(client.room_id in room_list){
      console.log("state : "+room_list[client.room_id].state);
      switch(room_list[client.room_id].state){
        case "wait":
          if(json.type=='setName'){
            //player login
            if(room_list[client.room_id].player_data.length>=0&&room_list[client.room_id].player_data.length<10){
              //insert player into player_data
              insertPlayerData(json.name);
              console.log("player "+client.name+" ("+client.id+") login");
              //update player list
              updatePlayerList();
              //update ready state
              updateAllReadyState();

              socket.broadcast.emit('updateRoom',{room_list:room_list});
  
            }else{
              console.log("player login failed (server is full)");
              //the server is full!
              var obj = {state:room_list[client.room_id].state, type:'full',room_id:client.room_id};
              obj['text']='Sorry, the server is full';
              if(show_emit) console.log("emit server full (one client)");
              socket.emit('system',obj);
              //update player list
              updatePlayerList();
              //update ready state
              updateAllReadyState();
              
            }
          }else if(json.type=='readyButton'){
            console.log(client.name+" ("+client.id+") ready");
            //client press ready or not yet
            updateReadyState(json.value);
            //update player list
            updatePlayerList();
            //update ready state
            updateAllReadyState();
          }else if(json.type=='playButton'){
            console.log(client.name+ " ("+client.id+")(room owner) press start game");
            //room owner press play!
            //tell client to change state
            changeState(states[1]);
            setGoodEvil();
            askCharactersSet();
          }
  
          break;
        case "randomCharacters":
          if(json.type=='ready'){
            room_list[client.room_id].good_characters = json.good_characters;
            room_list[client.room_id].evil_characters = json.evil_characters;
            console.log(client.name + ' ('+client.id+')(room owner) done characters choosing');
  
            //random characters to players
            randomSetCharacters();
            
            changeState(states[2]);
  
            setLeader();
  
          }
          break;
        case "sendMission":
          if(json.type=='ready'){
            room_list[client.room_id].team_members = json.team_members;
            console.log(client.name+' ('+client.id+')done team members choosing');
  
            resetVote();
            if(room_list[client.room_id].vote_turn==4){
              //no need to vote
              console.log("5th team members setting, no need to vote");
              room_list[client.room_id].vote_turn = 0;
              changeState(states[4]);
              missionVote();
              updatePlayerList();
              updateTeamMemberList();
            }else{
              console.log("voting for team members");
              changeState(states[3]);
              voting();
            }
          }else if(json.type=='update'){
            //update if teammembers or not
            for(i=0;i<room_list[client.room_id].player_data.length;i++){
              if(room_list[client.room_id].player_data[i]['id']==json.id){
                room_list[client.room_id].player_data[i]['teammembers']=json.value;            }
            }
            updateTeamMemberList();
  
          }
          break;
        case "vote":
            if(json.type=='vote'){
              console.log("(vote)"+client.name+" ("+client.id +") : "+ json.value);
              updateVote(json.value);
            }
          break;
        case "mission":
            if(json.type=='vote'){
              console.log("(mission)"+client.name+" ("+client.id +") : "+ json.value);
              updateMissionVote(json.value);
            }
          break;
        case "missionSuccess":
          break;
        case "missionFail":
          break;
        case "update":
          break;
        case "findMerlin":
          if(json.type=='find'){
            console.log(client.name+' ('+client.id + ") think " + json.value + " is Merlin");
            var find=false;
            var new_state;
  
            find = findMerlinOrNot(json.value);
            
            if(find){
              //evil win
              console.log("Merlin is killed!");
              new_state = states[9];
            }else{
              //good win
              console.log("Merlin is alive!");
              new_state = states[10];
            }
            changeState(new_state);
            if(show_emit) console.log("emit end game (all clients)");
            socket.emit('system',{state:room_list[client.room_id].state,type:'endGame',last_player_data:room_list[client.room_id].player_data,room_id:client.room_id});
            socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'endGame',last_player_data:room_list[client.room_id].player_data,room_id:client.room_id});
            init();
            changeState(states[0]);
            updatePlayerList();
          }
          break;
        default:
          break;
      }
    }else{
      socket.emit('system',{type:'exitRoom',room_id:client.room_id,room_list:room_list});
    }

  });
  

//--------------All states are different--------------//



//--------------All states are same--------------//
    
  //对message事件的监听 only for chatting
  socket.on('message', function(json){
    if(client.room_id in room_list){
      var obj = {time:getTime(),color:client.color,room_id:client.room_id};
      //如果不是第一次的连接，正常的聊天消息
      obj['text']=json.msg;
      obj['author']=client.name;      
      obj['type']='message';
      //console.log(client.name + ' say: ' + msg);
      // 返回消息（可以省略）
      socket.emit('message',obj);
      // 广播向其他用户发消息
      socket.broadcast.emit('message',obj);
    }
  });


  //监听出退事件
  socket.on('disconnect', function () {  
    var obj = {
      time:getTime(),
      color:client.color,
      author:'System',
      text:client.name,
      type:'disconnect',
      room_id:client.room_id
    };
    // 广播用户已退出
    //remove this player from player_data
    if(client.room_id!=null && client.room_id in room_list) {
      removePlayer();
    
      socket.broadcast.emit('system',obj);
      console.log(client.name + '(' + client.id+ ') Disconnect');
      //console.log('total player number: '+player_data.length);
  
  
      if(room_list[client.room_id].state != "wait"){
        resetPlayerData();
        changeState(states[0]);
      }
      if(room_list[client.room_id].player_data.length<5){
        //set all ready to false
        if(show_emit) console.log("emit hide ready (all clients)");
        socket.emit('system',{state:room_list[client.room_id].state,type:'hideReady',room_id:client.room_id});
        socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'hideReady',room_id:client.room_id});
        resetPlayerData();
      }
      //console.log(player_data);
      init();
      //update player list
      updatePlayerList();
      //update ready state
      updateAllReadyState();

      if(room_list[client.room_id].player_data.length==0){
        delete room_list[client.room_id];
      }
      client.room_id = null;
    }
  });
//--------------All states are same--------------//
//--------------Function to use here--------------//
//--------------All states--------------//
  var init=function(){
    //initial
    room_list[client.room_id].leader_id = null;
    room_list[client.room_id].turn = 0;
    room_list[client.room_id].vote_turn = 0;
    room_list[client.room_id].success_time = 0;
    room_list[client.room_id].fail_time = 0;
    room_list[client.room_id].max_good = 0;
    room_list[client.room_id].max_evil = 0;
    room_list[client.room_id].good_characters = [];
    room_list[client.room_id].evil_characters = [];
    room_list[client.room_id].all_characters = [];
    room_list[client.room_id].team_members = [];
    room_list[client.room_id].state = states[0];
    room_list[client.room_id].vote_fail = 0;
    room_list[client.room_id].vote_success = 0;
    resetVote();
    resetPlayerData();
    updateAllReadyState();
  };
  var removePlayer=function(){
    //remove player from player list
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      if(client.id==room_list[client.room_id].player_data[i]['id']){
        room_list[client.room_id].player_data.splice(i,1);
      }
    }
    //if the room owner disconnect, set new room owner
    if(client.id==room_list[client.room_id].room_owner_id && room_list[client.room_id].player_data.length>0)
      room_list[client.room_id].room_owner_id = room_list[client.room_id].player_data[0]['id'];
    else if(client.id==room_list[client.room_id].room_owner_id && room_list[client.room_id].player_data.length==0)
      room_list[client.room_id].room_owner_id = null;
  }
  var updatePlayerList=function(){
    //update player list
    updateObj={state:room_list[client.room_id].state,type:'playerList',room_owner_id:room_list[client.room_id].room_owner_id,room_id:client.room_id};
    updateObj['playerData']=room_list[client.room_id].player_data;
    //console.log(updateObj);
    if(show_emit) console.log("emit new player data (all clients)");
    socket.emit('system',updateObj);
    socket.broadcast.emit('system',updateObj);
  };

  var changeState=function(new_state){
    room_list[client.room_id].state = new_state;
    if(show_emit) console.log("emit new state : "+room_list[client.room_id].state+" (all clients)");
    socket.emit('system',{state:room_list[client.room_id].state,type:'changeState',room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'changeState',room_id:client.room_id});
    socket.broadcast.emit('updateRoom',{room_list:room_list});
  };
  var resetPlayerData=function(){
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      room_list[client.room_id].player_data[i]['role']=null;
      room_list[client.room_id].player_data[i]['ready']=false;
      room_list[client.room_id].player_data[i]['vote']=null;
      room_list[client.room_id].player_data[i]['teammembers']=false;
    }
  };
//--------------All states--------------//
//--------------wait states--------------//
  var insertPlayerData=function(name){
    if(room_list[client.room_id].room_owner_id==null) room_list[client.room_id].room_owner_id = room_list[client.room_id].player_id;
    //tell client they are join
    if(show_emit) console.log("emit client is join (one client)");
    socket.emit('system',{state:room_list[client.room_id].state,type:'join',value:true,player_id:room_list[client.room_id].player_id,room_owner_id:room_list[client.room_id].room_owner_id,room_id:client.room_id});
    
    client.name = name;

    var obj = {time:getTime(),color:client.color,room_id:client.room_id};
    obj['text']=client.name;
    obj['author']='System';
    obj['type']='welcome';
    obj['state']=room_list[client.room_id].state;    


    //add this player into player data
    var one_player_data = {id:room_list[client.room_id].player_id,name:client.name,role:null,ready:false,vote:null,color:client.color,teammembers:false}; //id & name & character & ready
    client.id = one_player_data['id'];
    client.index = room_list[client.room_id].player_data.length;
    room_list[client.room_id].player_data.push(one_player_data);
    room_list[client.room_id].player_id ++;
    //console.log(client.name + " id="+one_player_data['id']);

    //返回欢迎语
    socket.emit('system',obj);
    //广播新用户已登陆
    socket.broadcast.emit('system',obj);

    if(room_list[client.room_id].player_data.length>=5){
      if(show_emit) console.log("emit client can show ready (all clients)");
      socket.emit('system',{state:room_list[client.room_id].state,type:'ready',room_id:client.room_id});
      socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'ready',room_id:client.room_id});
    }
          
  };

  var updateReadyState=function(client_state){
    var obj={time:getTime(),color:client.color};
    obj['author']='System';
    obj['type']='ready';
    obj['state']=room_list[client.room_id].state;
    //console.log(client.name +" " + client_state);
    //find the players index
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      if(client.id==room_list[client.room_id].player_data[i]['id'])
        room_list[client.room_id].player_data[i]['ready']=client_state;
    }
    
  };
  var setGoodEvil=function(){
    room_list[client.room_id].max_good = good_evil_count[room_list[client.room_id].player_data.length-5][0];
    room_list[client.room_id].max_evil = good_evil_count[room_list[client.room_id].player_data.length-5][1];
  };
  var askCharactersSet=function(){
    //clear last player data
    //console.log('room owner, ask characters set');
    updatePlayerList();
    var ask = {type:'chooseCharactersSet',state:room_list[client.room_id].state,good:room_list[client.room_id].max_good,evil:room_list[client.room_id].max_evil,room_id:client.room_id};
    if(show_emit) console.log('emit ask room owner '+client.name+' ('+client.id+') to set characters (one client)');
    socket.emit('system',ask);
    socket.broadcast.emit('system',ask);
    
  };
  var updateAllReadyState=function(){
    all_ready = true; //check if all the players are ready
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      all_ready = all_ready & room_list[client.room_id].player_data[i]['ready'];
    }
    //console.log(all_ready);
    if(all_ready){
      if(show_emit) console.log("emit tell all clients everyone is ready (all clients)");
      socket.emit('system',{state:room_list[client.room_id].state,type:'allReady',value:true,room_id:client.room_id});
      socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'allReady',value:true,room_id:client.room_id});
    }else{
      if(show_emit) console.log("emit tell all clients someone is not ready (all clients)");
      socket.emit('system',{state:room_list[client.room_id].state,type:'allReady',value:false,room_id:client.room_id});
      socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'allReady',value:false,room_id:client.room_id});

    }
  };
//--------------wait states--------------//
//--------------randomCharacters states--------------//
  var randomSetCharacters=function(){
    while(room_list[client.room_id].good_characters.length<room_list[client.room_id].max_good){
      room_list[client.room_id].good_characters.push('Stupid Good');
    }
    while(room_list[client.room_id].evil_characters.length<room_list[client.room_id].max_evil){
      room_list[client.room_id].evil_characters.push('Stupid Evil');
    }
    //all_characters = good_characters.concat(evil_characters);
    for(i=0;i<room_list[client.room_id].good_characters.length;i++){
      room_list[client.room_id].all_characters.push([room_list[client.room_id].good_characters[i],'Good']);
    }
    for(i=0;i<room_list[client.room_id].evil_characters.length;i++){
      room_list[client.room_id].all_characters.push([room_list[client.room_id].evil_characters[i],'Evil']);
    }
    shuffleArray();
    //console.log(all_characters);
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      room_list[client.room_id].player_data[i]['ready']=false;
      room_list[client.room_id].player_data[i]['role']=room_list[client.room_id].all_characters[i];
    }
    //console.log(player_data);
  };
  var shuffleArray=function(){
    var counter = room_list[client.room_id].all_characters.length;
    while(counter>0){
      var index = Math.floor(Math.random()*counter);
      counter--;
      var temp = room_list[client.room_id].all_characters[counter];
      room_list[client.room_id].all_characters[counter] = room_list[client.room_id].all_characters[index];
      room_list[client.room_id].all_characters[index] = temp;
    }
  };
//--------------randomCharacters states--------------//
//--------------sendMission states--------------//
  var setLeader=function(){
    resetTeamMembers();
    updateTeamMemberList();
    if(room_list[client.room_id].leader_id==null){
      room_list[client.room_id].leader_id = room_list[client.room_id].player_data[ Math.floor((Math.random() * room_list[client.room_id].player_data.length)) ]['id'];
    }else{
      if(room_list[client.room_id].leader_id == room_list[client.room_id].player_data[room_list[client.room_id].player_data.length-1]['id']){
        room_list[client.room_id].leader_id = room_list[client.room_id].player_data[0]['id'];
      }else{
        for(i=0;i<room_list[client.room_id].player_data.length;i++){
          if(room_list[client.room_id].leader_id == room_list[client.room_id].player_data[i]['id']){
            room_list[client.room_id].leader_id = room_list[client.room_id].player_data[i+1]['id'];
            break;
          }
        }
      }
    }
    //console.log("set leader, turn: ");
    //console.log(turn);
    num_of_team = team_assignment[room_list[client.room_id].player_data.length-5][0][room_list[client.room_id].turn];
    two_fail = team_assignment[room_list[client.room_id].player_data.length-5][1];


    socket.emit('system',{state:room_list[client.room_id].state,type:'setLeader',leader_id:room_list[client.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[client.room_id].turn,vote_turn:room_list[client.room_id].vote_turn,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'setLeader',leader_id:room_list[client.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[client.room_id].turn,vote_turn:room_list[client.room_id].vote_turn,room_id:client.room_id});
    
    //update player listu
    updatePlayerList();
    if(show_emit) console.log('emit set leader (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state,type:'setLeader',leader_id:room_list[client.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[client.room_id].turn,vote_turn:room_list[client.room_id].vote_turn,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'setLeader',leader_id:room_list[client.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[client.room_id].turn,vote_turn:room_list[client.room_id].vote_turn,room_id:client.room_id});
    
  };

  var resetVote=function(){
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      room_list[client.room_id].player_data[i]['vote']=null;
    }
  }
  var resetTeamMembers=function(){
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      room_list[client.room_id].player_data[i]['teammembers']=false;
    }

  }
  var updateTeamMemberList=function(){
    if(show_emit) console.log('emit update team members (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state, type:'updateTeamMember', player_data:room_list[client.room_id].player_data,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state, type:'updateTeamMember', player_data:room_list[client.room_id].player_data,room_id:client.room_id});
  }
//--------------sendMission states--------------//
//--------------vote states--------------//
  var voting=function(){
    if(show_emit) console.log('emit start voting (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state,type:'vote',team_members:room_list[client.room_id].team_members, player_data:room_list[client.room_id].player_data,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'vote',team_members:room_list[client.room_id].team_members, player_data:room_list[client.room_id].player_data,room_id:client.room_id});

    };

  var updateVote=function(value){
    //update vote (true/false) into player_data
    var agree = 0;
    var disagree = 0;
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      if(room_list[client.room_id].player_data[i]['id']==client.id){
        room_list[client.room_id].player_data[i]['vote']=value;
      }
      if(room_list[client.room_id].player_data[i]['vote']==true){
        agree++;
      }else if(room_list[client.room_id].player_data[i]['vote']==false){
        disagree++;
      }
    }
    if((agree+disagree)==room_list[client.room_id].player_data.length){//if all players have voted
      if(disagree>=agree){
      //if disagree>=agree, back to sendMission state
        room_list[client.room_id].vote_turn++;
        changeState(states[2]);
        setLeader();

      }else if(agree>disagree){
      //if agree>disagree, go to mission state
        room_list[client.room_id].vote_turn = 0;
        changeState(states[4]);
        missionVote();
        updatePlayerList();
        updateTeamMemberList();
      }
    }
  }

//--------------vote states--------------//
//--------------mission states--------------//
  var missionVote=function(){
    if(show_emit) console.log('emit to do mission (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state,type:'vote',team_members:room_list[client.room_id].team_members,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'vote',team_members:room_list[client.room_id].team_members,room_id:client.room_id}); 

  }
  var updateMissionVote=function(value){
    var two_fail = team_assignment[room_list[client.room_id].player_data.length-5][1];
    if(value) room_list[client.room_id].vote_success++;
    else room_list[client.room_id].vote_fail++;

    if((room_list[client.room_id].vote_success+room_list[client.room_id].vote_fail)==room_list[client.room_id].team_members.length){
      room_list[client.room_id].turn++;
      var new_state;
      if(room_list[client.room_id].turn==4 && two_fail){
        if(room_list[client.room_id].vote_fail>=2){
          //fail
          new_state = states[6];
          room_list[client.room_id].fail_time++;

        }else{
          //success
          new_state = states[5];
          room_list[client.room_id].success_time++;

        }
      }else{
        if(room_list[client.room_id].vote_fail>=1){
          //fail
          new_state = states[6];
          room_list[client.room_id].fail_time++;

        }else{
          //success
          new_state = states[5];
          room_list[client.room_id].success_time++;

        }
      }
      changeState(new_state);
      if(show_emit) console.log('emit to update new game details (all clients)');
      socket.emit('system',{state:room_list[client.room_id].state,type:'update',detail:[room_list[client.room_id].vote_success,room_list[client.room_id].vote_fail,room_list[client.room_id].success_time,room_list[client.room_id].fail_time],room_id:client.room_id});
      socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'update',detail:[room_list[client.room_id].vote_success,room_list[client.room_id].vote_fail,room_list[client.room_id].success_time,room_list[client.room_id].fail_time],room_id:client.room_id}); 
      changeState(states[7]);
      updateGame();
    }

      
  }
//--------------mission states--------------//
//--------------update states--------------//
var updateGame=function(){
  room_list[client.room_id].vote_success = 0;
  room_list[client.room_id].vote_fail = 0;
  if(room_list[client.room_id].fail_time>=3){//Evil win
    changeState(states[9]);
    if(show_emit) console.log('emit end game (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state,type:'endGame',last_player_data:room_list[client.room_id].player_data,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'endGame',last_player_data:room_list[client.room_id].player_data,room_id:client.room_id});
    init();
    changeState(states[0]);
    updatePlayerList();
  }else if(room_list[client.room_id].success_time>=3){//go into find merlin
    changeState(states[8]);
    var kill_list = [];
    for(i=0;i<room_list[client.room_id].player_data.length;i++){
      if(room_list[client.room_id].player_data[i]['role'][1]=='Good'){
        kill_list.push([room_list[client.room_id].player_data[i]['id'], room_list[client.room_id].player_data[i]['name']]);
      }
    }
    //console.log(kill_list);
    if(show_emit) console.log('emit kill Merlin and kill list (all clients)');
    socket.emit('system',{state:room_list[client.room_id].state,type:'kill',kill_list:kill_list,room_id:client.room_id});
    socket.broadcast.emit('system',{state:room_list[client.room_id].state,type:'kill',kill_list:kill_list,room_id:client.room_id});
    updatePlayerList();
  }else{
    changeState(states[2]);
    setLeader();
  }
}
//--------------update states--------------//
//--------------findMerlin states--------------//
var findMerlinOrNot=function(id){
  for(i=0;i<room_list[client.room_id].player_data.length;i++){
    if(room_list[client.room_id].player_data[i]['id']==id && room_list[client.room_id].player_data[i]['role'][0]=="Merlin"){
      //evil win
      return true;
    }
  }
  return false;
}
//--------------findMerlin states--------------//


//--------------Function to use here--------------//

});
//----------------------------------------------------------------------//









//----------------------------------------------------------------------//
//dont change now
//express基本配置
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// 指定webscoket的客户端的html文件
app.get('/', function(req, res){
  res.sendfile('views/chat.html');
});

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var getTime=function(){
  var date = new Date();
  return date.getHours()+":"+date.getMinutes()+":"+date.getSeconds();
}

var getColor=function(){
  //var colors = ['aliceblue','antiquewhite','aqua','aquamarine','pink','red','green','orange','blue','blueviolet','brown','burlywood','cadetblue'];
  //return colors[Math.round(Math.random() * 10000 % colors.length)];
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++ ) {
    if(i%2==0){
      color += letters[Math.floor(Math.random() * 10)+6];
    }else{
      color += letters[Math.floor(Math.random() * 16)];
    }
  }
  //console.log(color);
  return color;
}
//----------------------------------------------------------------------//