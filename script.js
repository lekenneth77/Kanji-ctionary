const DOMAIN_URL = "http://localhost:8000/api/realtime/convergence/default";
const MAX_PLAYERS = 4;
//TODO consider making a host bool instead of using fucking charAt(1) like a dumbass
var create = false;
var domain = null;
var room;
var messages = [];
var model = null;

//variables that belong to this user
var original_username = "";
var user = "";
var curr_chapter;
let ready = false;

var banned_roomnames = ["ohshititsarat", "hawaiian", "testingtest", "testingkenn"];

//document variables
var chat_input_box = document.getElementById("chat_input");

//Opens the username setup modal. If passed in parameter is true, changes the submit button to "CREATE", otherwise
//changes it to join.
function username_prompt(create) {
    this.create = create;
    document.getElementsByClassName("modal")[0].style.display = "block";
    if (create) {
        document.getElementById("submit_btn").innerHTML = "CREATE";
    } else {
        document.getElementById("submit_btn").innerHTML = "JOIN";
    }
}

//Opens the chapter modal. 
function open_chapter_modal() {
    //TODO add the chapter to the realtime model
    document.getElementsByClassName("modal")[1].style.display = "block";
}

//Closes the Modal. If passed in parameter is true, closes the username setup modal, otherwise closes the chapter modal.
function close_modal(modal_one) {
    if (modal_one) {
        document.getElementsByClassName("modal")[0].style.display = "none";
        document.getElementById("room_name_input").value = "";
        document.getElementById("username_input").value = "";
        var err_arr = document.getElementsByClassName("input_err");
        for (let i = 0; i < err_arr.length; i++) {
            err_arr[i].style.display = "none";
        }
    } else {
        document.getElementsByClassName("modal")[1].style.display = "none";
    }
}

//Closes the modals if you click anywhere outside of them.
window.onclick = function(event) {
    if (event.target == document.getElementsByClassName("modal")[0]) {
      close_modal(true);
    }
    if (event.target == document.getElementsByClassName("modal")[1]) {
        close_modal(false);
      }

  }

//Checks if the room name and user name are valid inputs.
//Currently must be less than 10 characters for it to work and user cannot be '<c>';
//If valid inputs, connect to domain and room, if invalid, display errors.
function check_input_values() {
    //reset error displays
    var err_arr = document.getElementsByClassName("input_err");
    for (let i = 0; i < err_arr.length; i++) {
        err_arr[i].style.display = "none";
    }

    var room_name = document.getElementById("room_name_input").value;
    var username = document.getElementById("username_input").value;
    let successful = true;
    //check room name
    if (room_name.length > 20) {
        err_arr[0].style.display = "block";
        successful = false;
    } else if (room_name.length == 0) {
        err_arr[1].style.display = "block";
        successful = false;
    }

    //check user name
    if (username.length > 10) {
        err_arr[2].style.display = "block";
        successful = false;
    } else if (username.length == 0) {
        err_arr[3].style.display = "block";
        successful = false;
    } else if (username == '<c>' || username == '<c>:') {
        err_arr[4].style.display = "block";
        successful = false;
    }
    //start loading...
    if (successful) {
        attempt_connection(room_name, username);
    }
}

//Main setup of the Room and Realtime Model. Attempts connection to the domain.
function attempt_connection(room_name, username) {
    //display loading screen...
    document.getElementById("front_page").style.display = "none";
    document.getElementById("loader").style.display = "block";
    var loader_text = document.getElementById("loader_text");
    if (create) {
        loader_text.innerHTML = "Creating Room...";
    } else {
        loader_text.innerHTML = "Joining Room...";
    }
    loader_text.style.display = "block";

    //Attempt connection to domain
    Convergence.connectAnonymously(DOMAIN_URL, username)
    .then(d => {
        original_username = username;
        this.domain = d;

        if (create) { //Creates the chat room if creating one. Cannot have the same name as an existing room.
            username = "(Host) " + username;
            return this.domain.chat().create({
                id: room_name,
                type: "room",
                membership: "public",
            });
        } else {
            username = "(Member) " + username;
            return room_name;
        }
    }).then(channelId => this.domain.chat().join(channelId)) //Join the chat room.
    .then(r => {
            this.room = r;
            user = username;
            console.log("Room Testing... ID: " + room.info().chatId)
            console.log("User: " + username)
            print_members();
            let room_arr = room.info().members;
            //create room cleanup, only works if creator has different name than leftovers from previous session
            //might not be a bug later TODO
            if (user.charAt(1) == 'H' && room_arr[0].user.displayName != original_username) {
                console.log("Cleaning up leftovers...")
                for (let i = 0; i < room_arr.length; i++) {
                    if (room_arr[i].user.displayName != original_username) {
                        room.remove(room_arr[i].user.userId);
                    }
                }
            }

            //If user closes or refreshes page, must leave room and domain. If host leaves, must also remove the
            //room from the domain.
            window.onbeforeunload = function(){
                if (user.charAt(1) == 'H') {
                    console.log("I'm the host!")
                    this.domain.chat().leave(room_name);
                    this.domain.chat().remove(room_name);
                } else {
                    console.log("I'm not the host!")``
                    this.domain.chat().leave(room_name);
                }
                return;
            };

            //gacky TODO make it better
            //Checks if the recently joined user has the same name as another user, if so, make them leave by
            //refreshing their page and ask them to use a different name.
            if (!create) {
                let count = 0;
                for (let i = 0; i < room_arr.length; i++) {
                    if (room_arr[i].user.displayName == original_username) {
                        count++;
                    }
                    if (count == 2) {
                        alert("You can't have the same name as someone else in this lobby! Choose a different name!")
                        window.location.reload();
                    }
                }
            }


            //set up member disallowed events
            if (user.charAt(1) != 'H') {
                document.getElementById('start_game').innerHTML = "READY";
                document.getElementById('chapter_button').style.display = 'none';
                for (let i = 0; i < MAX_PLAYERS - 1; i++) {
                    document.getElementsByClassName('remove_player')[i].disabled = true;
                }
            }

            //setup player names and images at start
            for (let i = 0; i < room_arr.length; i++) {
                document.getElementsByClassName("name")[i].innerHTML = room_arr[i].user.displayName;
                document.getElementsByClassName("name_img")[i].style.display = "block";
            }
            
            //get rid of loading page and display pregame screen.
            document.getElementById("loader").style.display = "none";
            document.getElementById("loader_text").style.display = "none";
            document.getElementById("pregame_screen").style.display = "block";
            document.getElementById("room_title").innerHTML = "ROOM NAME: " + room.info().chatId;

            //Puts a message in chat for the current user to see that they joined the room.
            let success_message = document.createElement("div");
            success_message.className = "chat_message console_message";
            success_message.innerHTML = "Joined " + room.info().chatId + "...";
            document.getElementById("chatbox").appendChild(success_message);
            
            //Listen for room events.
            room_listen(r);

            this.domain.models().openAutoCreate({ //Creates the model if not existant, joins if already exists.
                collection: 'shared_data',
                id: room.info().chatId,
                data: {
                    "players_ready" : [],
                    "chapter" : ""
                },
                ephemereal: true
            }).then(m => {
                this.model = m;
                if (create) {
                    console.log("Model Created. Model ID: " + model.modelId());
                } else {
                    console.log("Model Joined. Model ID: " + model.modelId());
                }

                //Allow non-hosts to click the ready button. Sets up any model changes for just joining players.
                if (!create) {
                    document.getElementById('start_game').disabled = false;

                    let room_arr = room.info().members;
                    let arr = model.elementAt("players_ready").value();
                    for (let i = 1; i < room_arr.length; i++) {
                        let curr_name = room_arr[i].user.displayName;
                        for (let j = 0; j < arr.length; j++) {
                            if (arr[j] == curr_name) {
                                document.getElementsByClassName('ready_box')[i - 1].style.display = "block";
                                break;
                            }
                        }
                    }

                    document.getElementById("room_chapter").innerHTML = "CHAPTER: " + model.elementAt("chapter").value();;

                }
                //Listen for model events.
                modelListen(m);
            }).catch(err => console.error('Model Error:' + err));

    }).catch(err => {
        alert(err);
        reset_to_front(); //TODO probably have to do more than just this, like disconnect from domain.
    });
}

//Resets everything to front. Usually won't use this, probably will just force a reload from the user in the end.
function reset_to_front() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("loader_text").style.display = "none";
    document.getElementsByClassName("modal")[0].style.display = "none";
    document.getElementsByClassName("modal")[1].style.display = "none";
    document.getElementById("pregame_screen").style.display = "none";
    document.getElementById("front_page").style.display = "block";
    //might need to unappend all children attatched to the chatbox_container TODO
}

//Room event listeners
function room_listen(room) {
    //When the room gets a message, display the message into the chat box.
    //If message received was a console message, display as so, otherwise, display as a normal message.
    room.on("message", e => {
        let messages_arr = messages.slice(0);
        messages_arr.push(e.message);
        messages = messages_arr;
        let result;
        let shown_msg = document.createElement("div");
        shown_msg.className = "chat_message";

        //check if it's a console message
        if (e.message.charAt(0) == '<' && e.message.charAt(1) == 'c' && e.message.charAt(2) == '>' && e.message.charAt(3) == ':') {
            result = e.message.slice(4);
            shown_msg.className += " console_message";
        } else {
            result = e.message;
        }
        shown_msg.innerHTML = result;
        document.getElementById("chatbox").appendChild(shown_msg);
    });

    //Displays a message into the chatbox when a user joins. Also checks for the really wacky same user double join error.
    //If that error occurs, force the user to reload the page. 
    room.on("user_joined", e => {
        if (user.charAt(1) == 'H') {
            console.log("This guy just joined! : " + e.user.displayName)
            send_message(e.user.displayName + " has joined.", true);
        }
        print_members();
        let room_arr = room.info().members;
        if (room_arr[room_arr.length - 2].user.userId.equals(room_arr[room_arr.length - 1].user.userId)) {
            alert("Please Retry! (May take a couple tries...!)")
            window.location.reload();
        }
        for (let i = 0; i < room_arr.length; i++) {
            document.getElementsByClassName("name")[i].innerHTML = room_arr[i].user.displayName;
            document.getElementsByClassName("name_img")[i].style.display = "block";
        }
    });

    //Displays a message into the chatbox when a user leaves.
    room.on("user_left", e => {
        if (user.charAt(1) == 'H') {
            send_message(e.user.displayName + " has left.", true);
        }
        console.log("That guy just left! : " + e.user.displayName)
        print_members();
        let name_list = document.getElementsByClassName("name");
        let name_imgs = document.getElementsByClassName("name_img");
        let room_arr = room.info().members;
        for (let i = 0; i < MAX_PLAYERS; i++) {
            if (room_arr.length <= i) {
                name_list[i].innerHTML = "";
                name_imgs[i].style.display = "none";
            } else {
                name_list[i].innerHTML = room_arr[i].user.displayName;
                name_imgs[i].style.display = "block";
            }
        }
        if (model != null) {
            remove_ready(e.user.displayName);
            remove_ready_box();
        }
    });

    room.on("user_removed", e => {
        //TODO UHHH THIS WILL REMOVE ALL PLAYERS WITH THE SAME NAME
        if (e.removedUser.displayName == original_username) {
            //TODO GET OUT OF THE DOMAIN
            window.location.reload();
        }
        if (user.charAt(1) == 'H') {
            send_message(e.removedUser.displayName + " has been removed.", true);
        }
        console.log("That guy was removed! : " + e.user.displayName)
        print_members();
        let name_list = document.getElementsByClassName("name");
        let name_imgs = document.getElementsByClassName("name_img");
        let room_arr = room.info().members;
        for (let i = 0; i < MAX_PLAYERS; i++) {
            if (room_arr.length <= i) {
                name_list[i].innerHTML = "";
                name_imgs[i].style.display = "none";
            } else {
                name_list[i].innerHTML = room_arr[i].user.displayName;
                name_imgs[i].style.display = "block";
            }
        }
        if (model != null) {
            remove_ready(e.removedUser.displayName);
        }
    })
} 

function print_members() {
    let room_arr = room.info().members;
    console.log("Member List:")
    for (let i = 0; i < room_arr.length; i++) {
        console.log("Member " + i + ": " + room_arr[i].user.displayName)
    }
}

chat_input_box.addEventListener("keydown", e => {
    if (e.key == "Enter") {
        send_message(document.getElementById("chat_input").value, false);
    }
});

function send_message(message, cons) {
    try {  
        if (cons) {
            room.send('<c>: ' + message);
            console.log("Successful Console Message! : " + message)
        } else {
            room.send(user + ": " + message);
            console.log("Successful Message! :" + message)
        }
    } catch (e) {
        console.error("Couldn't send Message! " + e)
    }
    chat_input_box.value = "";
}

function remove_player(player) {
    console.log("HEY ONLY THE HOST SHOULD BE DOING THIS!")
    room.remove(room.info().members[player].user.userId).then(() => {
        return;
    }).catch(err => console.error(err))
}


function start_game() {
    if (!create) {
        if (ready) {
            ready = false;
            display_ready(original_username, "none");
            remove_ready(original_username);
        } else {
            ready = true;
            model.elementAt("players_ready").push(original_username);
            display_ready(original_username, "block");
        } 
    } else {
        if (document.getElementById('room_chapter').innerHTML == "CHAPTER:") {
            alert("Please choose a chapter first!")
        } else if (room.info().members.length == 1) {
            alert("You can't start a game by yourself!")
        } else if ((room.info().members.length - 1) != model.elementAt("players_ready").value().length) {
            alert("Everyone isn't ready yet!")
        } else {
            console.log("Let the games begin!")
        }

    }
}


//Model Functions
function modelListen(model) {
    model.elementAt("players_ready").on("insert", e => {
        console.log("Real Time Ready Array Inserted this Value: " + e.value.value());
        if (create) { //allow player to start game
            document.getElementById('start_game').disabled = false;
        }
        display_ready(e.value.value(), "block");
        
    });

    model.elementAt("players_ready").on("remove", e => {
        console.log("Real Time Ready Array Removed A Value.")
        remove_ready_box();
    })

    model.elementAt("chapter").on("value", e => {
        let chp = model.elementAt("chapter").value();
        set_chapter(chp);
    })
}

function display_ready(user, display) {
    let room_arr = room.info().members;
        for (let i = 1; i < room_arr.length; i++) {
            if (room_arr[i].user.displayName == user) {
                document.getElementsByClassName('ready_box')[i - 1].style.display = display;
                break;
            }
        }
}

function remove_ready(user) {
    let arr = model.elementAt("players_ready").value();
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] == user) {
            model.elementAt("players_ready").remove(i);
            console.log("Array After Removal: " + model.elementAt("players_ready").value())
            return;
        }
    }
}

function remove_ready_box() {
    let room_arr = room.info().members;
    let ready_arr = model.elementAt("players_ready").value();
    for (let i = 0; i < MAX_PLAYERS - 1; i++) {
        document.getElementsByClassName('ready_box')[i].style.display = "none";
    }
    for (let i = 1; i < room_arr.length; i++) {
        let curr_user = room_arr[i].user.displayName;
        if (ready_arr.indexOf(curr_user) == -1) {
            document.getElementsByClassName('ready_box')[i - 1].style.display = "none";
        } else {
            document.getElementsByClassName('ready_box')[i - 1].style.display = "block";
        }
    }
}

function set_chapter(chapter) {
    if (create) {
        model.elementAt("chapter").value(chapter);
        document.getElementsByClassName("modal")[1].style.display = "none";
    }
    if (chapter == "Yookoso 1 CH1") {
        document.getElementById("room_chapter").innerHTML = "CHAPTER: " + chapter;
        curr_chapter = chp_1_kanji;
        console.log(curr_chapter)
    }
}

