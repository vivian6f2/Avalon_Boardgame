//----------------------------------------------------------------------//
//public information for avalon game
//game states
var states = ["wait","randomCharacters","sendMission","vote","mission",
  "missionSuccess","missionFail","update","findMerlin","evilWin","goodWin"]; //all states needed
var good_evil_count = [[3,2],[4,2],[4,3],[5,3],[6,3],[6,4]]; //rule
var team_assignment = [[[2,3,2,3,3],false],[[2,3,4,3,4],false],[[2,3,3,4,4],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true]]; //rule

//for debug
var show_emit = false;

var room_list = [];
//room class
var room = {
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
  socket.emit('open');//通知客户端已连接 //只傳給一個

  // 打印握手信息
  // console.log(socket.handshake);

  // 构造客户端对象
  var client = {
    socket:socket,
    name:false,
    color:getColor(),
    id:null //same as player_data[index]['id']
  };

//--------------All states are different--------------//
  socket.on('player', function(json){

    console.log("state : "+room.state);
    switch(room.state){
      case "wait":
        if(json.type=='setName'){
          //player login
          if(room.player_data.length>=0&&room.player_data.length<10){
            //insert player into player_data
            insertPlayerData(json.name);
            console.log("player "+client.name+" ("+client.id+") login");
            //update player list
            updatePlayerList();
            //update ready state
            updateAllReadyState();

          }else{
            console.log("player login failed (server is full)");
            //the server is full!
            var obj = {state:room.state, type:'full'};
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
          room.good_characters = json.good_characters;
          room.evil_characters = json.evil_characters;
          console.log(client.name + ' ('+client.id+')(room owner) done characters choosing');

          //random characters to players
          randomSetCharacters();
          
          changeState(states[2]);

          setLeader();

        }
        break;
      case "sendMission":
        if(json.type=='ready'){
          room.team_members = json.team_members;
          console.log(client.name+' ('+client.id+')done team members choosing');

          resetVote();
          if(room.vote_turn==4){
            //no need to vote
            console.log("5th team members setting, no need to vote");
            room.vote_turn = 0;
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
          for(i=0;i<room.player_data.length;i++){
            if(room.player_data[i]['id']==json.id){
              room.player_data[i]['teammembers']=json.value;            }
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
          socket.emit('system',{state:room.state,type:'endGame',last_player_data:room.player_data});
          socket.broadcast.emit('system',{state:room.state,type:'endGame',last_player_data:room.player_data});
          init();
          changeState(states[0]);
          updatePlayerList();
        }
        break;
      default:
        break;
    }


  });
  

//--------------All states are different--------------//



//--------------All states are same--------------//
    
  //对message事件的监听 only for chatting
  socket.on('message', function(msg){
    var obj = {time:getTime(),color:client.color};
    //如果不是第一次的连接，正常的聊天消息
    obj['text']=msg;
    obj['author']=client.name;      
    obj['type']='message';
    //console.log(client.name + ' say: ' + msg);
    // 返回消息（可以省略）
    socket.emit('message',obj);
    // 广播向其他用户发消息
    socket.broadcast.emit('message',obj);
  });


  //监听出退事件
  socket.on('disconnect', function () {  
    var obj = {
      time:getTime(),
      color:client.color,
      author:'System',
      text:client.name,
      type:'disconnect'
    };
    // 广播用户已退出
    //remove this player from player_data
    removePlayer();
    
    socket.broadcast.emit('system',obj);
    console.log(client.name + '(' + client.id+ ') Disconnect');
    //console.log('total player number: '+player_data.length);


    if(room.state != "wait"){
      resetPlayerData();
      changeState(states[0]);
    }
    if(room.player_data.length<5){
      //set all ready to false
      if(show_emit) console.log("emit hide ready (all clients)");
      socket.emit('system',{state:room.state,type:'hideReady'});
      socket.broadcast.emit('system',{state:room.state,type:'hideReady'});
      resetPlayerData();
    }
    //console.log(player_data);
    init();
    //update player list
    updatePlayerList();
    //update ready state
    updateAllReadyState();
  });
//--------------All states are same--------------//
//--------------Function to use here--------------//
//--------------All states--------------//
  var init=function(){
    //initial
    room.leader_id = null;
    room.turn = 0;
    room.vote_turn = 0;
    room.success_time = 0;
    room.fail_time = 0;
    room.max_good = 0;
    room.max_evil = 0;
    room.good_characters = [];
    room.evil_characters = [];
    room.all_characters = [];
    room.team_members = [];
    room.state = states[0];
    room.vote_fail = 0;
    room.vote_success = 0;
    resetVote();
    resetPlayerData();
    updateAllReadyState();
  };
  var removePlayer=function(){
    //remove player from player list
    for(i=0;i<room.player_data.length;i++){
      if(client.id==room.player_data[i]['id']){
        room.player_data.splice(i,1);
      }
    }
    //if the room owner disconnect, set new room owner
    if(client.id==room.room_owner_id && room.player_data.length>0)
      room.room_owner_id = room.player_data[0]['id'];
    else if(client.id==room.room_owner_id && room.player_data.length==0)
      room.room_owner_id = null;
  }
  var updatePlayerList=function(){
    //update player list
    updateObj={state:room.state,type:'playerList',room_owner_id:room.room_owner_id};
    updateObj['playerData']=room.player_data;
    //console.log(updateObj);
    if(show_emit) console.log("emit new player data (all clients)");
    socket.emit('system',updateObj);
    socket.broadcast.emit('system',updateObj);
  };

  var changeState=function(new_state){
    room.state = new_state;
    if(show_emit) console.log("emit new state : "+room.state+" (all clients)");
    socket.emit('system',{state:room.state,type:'changeState'});
    socket.broadcast.emit('system',{state:room.state,type:'changeState'});
  };
  var resetPlayerData=function(){
    for(i=0;i<room.player_data.length;i++){
      room.player_data[i]['role']=null;
      room.player_data[i]['ready']=false;
      room.player_data[i]['vote']=null;
      room.player_data[i]['teammembers']=false;
    }
  };
//--------------All states--------------//
//--------------wait states--------------//
  var insertPlayerData=function(name){
    if(room.room_owner_id==null) room.room_owner_id = room.player_id;
    //tell client they are join
    if(show_emit) console.log("emit client is join (one client)");
    socket.emit('system',{state:room.state,type:'join',value:true,player_id:room.player_id,room_owner_id:room.room_owner_id});
    
    client.name = name;

    var obj = {time:getTime(),color:client.color};
    obj['text']=client.name;
    obj['author']='System';
    obj['type']='welcome';
    obj['state']=room.state;    


    //add this player into player data
    var one_player_data = {id:room.player_id,name:client.name,role:null,ready:false,vote:null,color:client.color,teammembers:false}; //id & name & character & ready
    client.id = one_player_data['id'];
    client.index = room.player_data.length;
    room.player_data.push(one_player_data);
    room.player_id ++;
    //console.log(client.name + " id="+one_player_data['id']);

    //返回欢迎语
    socket.emit('system',obj);
    //广播新用户已登陆
    socket.broadcast.emit('system',obj);

    if(room.player_data.length>=5){
      if(show_emit) console.log("emit client can show ready (all clients)");
      socket.emit('system',{state:room.state,type:'ready'});
      socket.broadcast.emit('system',{state:room.state,type:'ready'});
    }
          
  };

  var updateReadyState=function(client_state){
    var obj={time:getTime(),color:client.color};
    obj['author']='System';
    obj['type']='ready';
    obj['state']=room.state;
    //console.log(client.name +" " + client_state);
    //find the players index
    for(i=0;i<room.player_data.length;i++){
      if(client.id==room.player_data[i]['id'])
        room.player_data[i]['ready']=client_state;
    }
    
  };
  var setGoodEvil=function(){
    room.max_good = good_evil_count[room.player_data.length-5][0];
    room.max_evil = good_evil_count[room.player_data.length-5][1];
  };
  var askCharactersSet=function(){
    //clear last player data
    //console.log('room owner, ask characters set');
    updatePlayerList();
    var ask = {type:'chooseCharactersSet',state:room.state,good:room.max_good,evil:room.max_evil};
    if(show_emit) console.log('emit ask room owner '+client.name+' ('+client.id+') to set characters (one client)');
    socket.emit('system',ask);
    socket.broadcast.emit('system',ask);
    
  };
  var updateAllReadyState=function(){
    all_ready = true; //check if all the players are ready
    for(i=0;i<room.player_data.length;i++){
      all_ready = all_ready & room.player_data[i]['ready'];
    }
    //console.log(all_ready);
    if(all_ready){
      if(show_emit) console.log("emit tell all clients everyone is ready (all clients)");
      socket.emit('system',{state:room.state,type:'allReady',value:true});
      socket.broadcast.emit('system',{state:room.state,type:'allReady',value:true});
    }else{
      if(show_emit) console.log("emit tell all clients someone is not ready (all clients)");
      socket.emit('system',{state:room.state,type:'allReady',value:false});
      socket.broadcast.emit('system',{state:room.state,type:'allReady',value:false});

    }
  };
//--------------wait states--------------//
//--------------randomCharacters states--------------//
  var randomSetCharacters=function(){
    while(room.good_characters.length<room.max_good){
      room.good_characters.push('Stupid Good');
    }
    while(room.evil_characters.length<room.max_evil){
      room.evil_characters.push('Stupid Evil');
    }
    //all_characters = good_characters.concat(evil_characters);
    for(i=0;i<room.good_characters.length;i++){
      room.all_characters.push([room.good_characters[i],'Good']);
    }
    for(i=0;i<room.evil_characters.length;i++){
      room.all_characters.push([room.evil_characters[i],'Evil']);
    }
    shuffleArray();
    //console.log(all_characters);
    for(i=0;i<room.player_data.length;i++){
      room.player_data[i]['ready']=false;
      room.player_data[i]['role']=room.all_characters[i];
    }
    //console.log(player_data);
  };
  var shuffleArray=function(){
    var counter = room.all_characters.length;
    while(counter>0){
      var index = Math.floor(Math.random()*counter);
      counter--;
      var temp = room.all_characters[counter];
      room.all_characters[counter] = room.all_characters[index];
      room.all_characters[index] = temp;
    }
  };
//--------------randomCharacters states--------------//
//--------------sendMission states--------------//
  var setLeader=function(){
    resetTeamMembers();
    updateTeamMemberList();
    if(room.leader_id==null){
      room.leader_id = room.player_data[ Math.floor((Math.random() * room.player_data.length)) ]['id'];
    }else{
      if(room.leader_id == room.player_data[room.player_data.length-1]['id']){
        room.leader_id = room.player_data[0]['id'];
      }else{
        for(i=0;i<room.player_data.length;i++){
          if(room.leader_id == room.player_data[i]['id']){
            room.leader_id = room.player_data[i+1]['id'];
            break;
          }
        }
      }
    }
    //console.log("set leader, turn: ");
    //console.log(turn);
    num_of_team = team_assignment[room.player_data.length-5][0][room.turn];
    two_fail = team_assignment[room.player_data.length-5][1];


    socket.emit('system',{state:room.state,type:'setLeader',leader_id:room.leader_id,team_size:num_of_team,two_fail:two_fail,turn:room.turn,vote_turn:room.vote_turn});
    socket.broadcast.emit('system',{state:room.state,type:'setLeader',leader_id:room.leader_id,team_size:num_of_team,two_fail:two_fail,turn:room.turn,vote_turn:room.vote_turn});
    
    //update player listu
    updatePlayerList();
    if(show_emit) console.log('emit set leader (all clients)');
    socket.emit('system',{state:room.state,type:'setLeader',leader_id:room.leader_id,team_size:num_of_team,two_fail:two_fail,turn:room.turn,vote_turn:room.vote_turn});
    socket.broadcast.emit('system',{state:room.state,type:'setLeader',leader_id:room.leader_id,team_size:num_of_team,two_fail:two_fail,turn:room.turn,vote_turn:room.vote_turn});
    
  };

  var resetVote=function(){
    for(i=0;i<room.player_data.length;i++){
      room.player_data[i]['vote']=null;
    }
  }
  var resetTeamMembers=function(){
    for(i=0;i<room.player_data.length;i++){
      room.player_data[i]['teammembers']=false;
    }

  }
  var updateTeamMemberList=function(){
    if(show_emit) console.log('emit update team members (all clients)');
    socket.emit('system',{state:room.state, type:'updateTeamMember', player_data:room.player_data});
    socket.broadcast.emit('system',{state:room.state, type:'updateTeamMember', player_data:room.player_data});
  }
//--------------sendMission states--------------//
//--------------vote states--------------//
  var voting=function(){
    if(show_emit) console.log('emit start voting (all clients)');
    socket.emit('system',{state:room.state,type:'vote',team_members:room.team_members, player_data:room.player_data});
    socket.broadcast.emit('system',{state:room.state,type:'vote',team_members:room.team_members, player_data:room.player_data});

    };

  var updateVote=function(value){
    //update vote (true/false) into player_data
    var agree = 0;
    var disagree = 0;
    for(i=0;i<room.player_data.length;i++){
      if(room.player_data[i]['id']==client.id){
        room.player_data[i]['vote']=value;
      }
      if(room.player_data[i]['vote']==true){
        agree++;
      }else if(room.player_data[i]['vote']==false){
        disagree++;
      }
    }
    if((agree+disagree)==room.player_data.length){//if all players have voted
      if(disagree>=agree){
      //if disagree>=agree, back to sendMission state
        room.vote_turn++;
        changeState(states[2]);
        setLeader();

      }else if(agree>disagree){
      //if agree>disagree, go to mission state
        room.vote_turn = 0;
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
    socket.emit('system',{state:room.state,type:'vote',team_members:room.team_members});
    socket.broadcast.emit('system',{state:room.state,type:'vote',team_members:room.team_members}); 

  }
  var updateMissionVote=function(value){
    var two_fail = team_assignment[room.player_data.length-5][1];
    if(value) room.vote_success++;
    else room.vote_fail++;

    if((room.vote_success+room.vote_fail)==room.team_members.length){
      room.turn++;
      var new_state;
      if(room.turn==4 && two_fail){
        if(room.vote_fail>=2){
          //fail
          new_state = states[6];
          room.fail_time++;

        }else{
          //success
          new_state = states[5];
          room.success_time++;

        }
      }else{
        if(room.vote_fail>=1){
          //fail
          new_state = states[6];
          room.fail_time++;

        }else{
          //success
          new_state = states[5];
          room.success_time++;

        }
      }
      changeState(new_state);
      if(show_emit) console.log('emit to update new game details (all clients)');
      socket.emit('system',{state:room.state,type:'update',detail:[room.vote_success,room.vote_fail,room.success_time,room.fail_time]});
      socket.broadcast.emit('system',{state:room.state,type:'update',detail:[room.vote_success,room.vote_fail,room.success_time,room.fail_time]}); 
      changeState(states[7]);
      updateGame();
    }

      
  }
//--------------mission states--------------//
//--------------update states--------------//
var updateGame=function(){
  room.vote_success = 0;
  room.vote_fail = 0;
  if(room.fail_time>=3){//Evil win
    changeState(states[9]);
    if(show_emit) console.log('emit end game (all clients)');
    socket.emit('system',{state:room.state,type:'endGame',last_player_data:room.player_data});
    socket.broadcast.emit('system',{state:room.state,type:'endGame',last_player_data:room.player_data});
    init();
    changeState(states[0]);
    updatePlayerList();
  }else if(room.success_time>=3){//go into find merlin
    changeState(states[8]);
    var kill_list = [];
    for(i=0;i<room.player_data.length;i++){
      if(room.player_data[i]['role'][1]=='Good'){
        kill_list.push([room.player_data[i]['id'], room.player_data[i]['name']]);
      }
    }
    //console.log(kill_list);
    if(show_emit) console.log('emit kill Merlin and kill list (all clients)');
    socket.emit('system',{state:room.state,type:'kill',kill_list:kill_list});
    socket.broadcast.emit('system',{state:room.state,type:'kill',kill_list:kill_list});
    updatePlayerList();
  }else{
    changeState(states[2]);
    setLeader();
  }
}
//--------------update states--------------//
//--------------findMerlin states--------------//
var findMerlinOrNot=function(id){
  for(i=0;i<room.player_data.length;i++){
    if(room.player_data[i]['id']==id && room.player_data[i]['role'][0]=="Merlin"){
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