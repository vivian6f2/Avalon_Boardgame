
# Avalon Boardgame (socket.io)
2018/02/04


A single page avalon boardgame using websocket. And a Node.js server to handle the game process. Using socket.io instead of ws modules.

### Detail

#### Server
* Implement a server to handle both chat room and Avalon game process with Node.js and socket.io.
* Designed a finate state machine for processing the game.

#### Client
* Implement a single page website to perform Avalon boardgame and chat room with jQuery.

Simple chat room example:<br>
http://blog.fens.me/nodejs-socketio-chat/ <br>
app.js for server<br>
chat.js for client<br>

### Install

```{bash}
npm install
node app.js
```

### Demo
After installing, 
http://localhost:3000
