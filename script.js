const DOMAIN_URL = "http://localhost:8000/api/realtime/convergence/default";
const MAX_PLAYERS = 4;
const MAX_TIME = 31;
//TODO consider making a host bool instead of using fucking charAt(1) like a dumbass
var create = false;
var domain = null;
var room;
var messages = [];
var model = null;

//variables that belong to this user
var original_username = "";
var user = "";
var curr_kanjis = [];
var curr_words;
let ready = false;
var started = false;

//variables for the host
var seconds_remaining = 31;
var host_timer;
var current_drawer = "";
var random_player_order = [];


var banned_roomnames = ["ohshititsarat", "hawaiian", "testingtest", "testingkenn"];

//document variables
var chat_input_box = document.getElementById("chat_input");

//canvas variables
let canPaint = false;
let isPainting = false;
let canvas = document.getElementById("drawing_board");
let ctx = canvas.getContext("2d");
var board = canvas.getBoundingClientRect();
let offsetX = board.left;
let offsetY = board.top;
canvas.width = window.innerWidth * (.5);
canvas.height = window.innerHeight * (.8);

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
                if (create) {
                    console.log("I'm the host!")
                    if (model != null) {
                        model.elementAt("started").value(false);
                        let arr = [];
                        model.elementAt("players_ready").value(arr);
                    }
                    this.domain.chat().leave(room_name);
                    this.domain.chat().remove(room_name);
                } else {
                    console.log("I'm not the host!")``
                    this.domain.chat().leave(room_name);
                }
                return;
            };


            //Forces refresh if the room is full when they join.
            if (!create) {
                if (room_arr.length > MAX_PLAYERS) {
                    alert("The room is full!")
                    window.location.reload();
                }
            }

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

            
            this.domain.models().openAutoCreate({ //Creates the model if not existant, joins if already exists.
                collection: 'shared_data',
                id: room.info().chatId,
                data: {
                    "players_ready" : [],
                    "chapter" : "",
                    "started": false,
                    "word_rng": -1,
                    "kanji_rng": -1,
                    "current_drawer": "",
                    "draw_arr": [],
                    "timer": 30
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
                    //Can't join if game has already started.
                    if (model.elementAt("started").value()) {
                        alert("The game is already in progress! Join once it's over!")
                        document.location.reload();
                    }

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
                modelListen(m); //Listens for model events
            }).catch(err => console.error('Model Error:' + err));


            //set up member disallowed events
            if (!create) {
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
            document.getElementById('chatbox').style.display = "flex";
            document.getElementById('chat_input_container').style.display = "block";
            document.getElementById("room_title").innerHTML = "ROOM NAME: " + room.info().chatId;

            //Puts a message in chat for the current user to see that they joined the room.
            let success_message = document.createElement("div");
            success_message.className = "chat_message console_message";
            success_message.innerHTML = "Joined " + room.info().chatId + "...";
            document.getElementById("chatbox").appendChild(success_message);
            
            //Listen for room events.
            room_listen(r);
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
        let name_list;
        let name_imgs;
        if (!started) {
            name_list = document.getElementsByClassName("name");
            name_imgs = document.getElementsByClassName("name_img");
        } else {
            name_list = document.getElementsByClassName("game_name");
            name_imgs = document.getElementsByClassName("game_name_img");
        }
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
        if (!started) { //remove ready's
            if (model != null) {
                remove_ready(e.user.displayName);
                remove_ready_box();
            }
        }
    });

    //Handles user being removed from the lobby.
    room.on("user_removed", e => {
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

//Prints the current members of the room.
function print_members() {
    let room_arr = room.info().members;
    console.log("Member List:")
    for (let i = 0; i < room_arr.length; i++) {
        console.log("Member " + i + ": " + room_arr[i].user.displayName)
    }
}

//Allows the user to press enter at the chat box to send their message.
chat_input_box.addEventListener("keydown", e => {
    if (e.key == "Enter") {
        send_message(document.getElementById("chat_input").value, false);
    }
});

//Sends the chat / console message to the room.
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

//Removes a player from the room.
function remove_player(player) {
    console.log("HEY ONLY THE HOST SHOULD BE DOING THIS!")
    room.remove(room.info().members[player].user.userId).then(() => {
        return;
    }).catch(err => console.error(err))
}

/*Starts the game only if these conditions are met. 
1) All non-host players are ready.
2) The host has chosen a chapter to play.
Only the host can start the game and choose a chapter.
*/
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
            model.elementAt("started").value(true);
            started = true;
            game_setup();
            console.log("Let the games begin!")
        }

    }
}


//Model Functions
function modelListen(model) {
    //pregame listeners
    model.elementAt("players_ready").on("insert", e => {
        console.log("Real Time Ready Array Inserted this Value: " + e.value.value());
        if (create) { //allow player to start game
            document.getElementById('start_game').disabled = false;
        }
        display_ready(e.value.value(), "block");
    })

    //One of the non-hosts has unreadied themselves.
    model.elementAt("players_ready").on("remove", e => {
        console.log("Real Time Ready Array Removed A Value.")
        remove_ready_box();
    })

    //Everyone will listen for whenever the host will set the chapter.
    model.elementAt("chapter").on("value", e => {
        let chp = model.elementAt("chapter").value();
        set_chapter(chp);
    })

    //Everyone will listen for when the host has started the game.
    model.elementAt("started").on("value", e => {
        if (model.elementAt("started").value()) {
            started = true;
            game_setup();
        }
    })

    //Listen for the timer
    model.elementAt("timer").on("value", e => {
        let val = model.elementAt("timer").value();
        document.getElementById("timer").innerHTML = val;
        if (val <= 0) {

        }
    })

    model.elementAt("current_drawer").on("value", e => {
        let drawer = model.elementAt("current_drawer").value();
        canPaint = false;
        isPainting = false;
        if (drawer == original_username) {
            let random_kanji = model.elementAt("kanji_rng").value();
            let random_word = model.elementAt("word_rng").value();
            document.getElementById("game_kana").innerHTML = curr_words[curr_kanjis[random_kanji]][random_word * 3 + 1];
            document.getElementById("game_english").innerHTML = curr_words[curr_kanjis[random_kanji]][random_word * 3 + 2];
            canPaint = true;
        } else {
            document.getElementById("game_kana").innerHTML = "";
            document.getElementById("game_english").innerHTML = "";
        }
        document.getElementById("overlay_text").innerHTML = drawer + " will draw!";
    })

    //drawing listeners
    const draw = (e) => {
        if(!isPainting) {
                return;
        }
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        let arr = [e.clientX, e.clientY];
        model.elementAt("draw_arr").push(arr);
        ctx.lineTo(e.clientX - offsetX, e.clientY - offsetY);
        ctx.stroke();
    }
    
    canvas.addEventListener('pointerdown', (e) => {
        if (canPaint) {
            isPainting = true;
        }
    });
     
    canvas.addEventListener('pointerup', e => {
        isPainting = false;
        ctx.stroke();
        ctx.beginPath();
    });
     
    canvas.addEventListener('pointermove', draw);

    //listen for changes to the drawing board!
    model.elementAt("draw_arr").on("insert", e => {
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        var coords = model.elementAt("draw_arr").shift().value();
        ctx.lineTo(coords[0] - offsetX, coords[1] - offsetY);
        ctx.stroke();
        ctx.stroke();
        ctx.beginPath();
    });

} // end of model listeners

//Given the user name, sets the user's ready to either block or none depending on the passed in "display" parameter.
function display_ready(user, display) {
    let room_arr = room.info().members;
        for (let i = 1; i < room_arr.length; i++) {
            if (room_arr[i].user.displayName == user) {
                document.getElementsByClassName('ready_box')[i - 1].style.display = display;
                break;
            }
        }
}

//Removes a player from the ready list.
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

//Removes the ready display box from the player list if someone has unreadied themselves.
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

//Sets the chapter.
function set_chapter(chapter) {
    if (create) {
        model.elementAt("chapter").value(chapter);
        document.getElementsByClassName("modal")[1].style.display = "none";
    }
    if (chapter == "Yookoso 1 CH1") {
        document.getElementById("room_chapter").innerHTML = "CHAPTER: " + chapter;
        for (let i = 0; i < chp_1_kanji.length; i++) {
            curr_kanjis.push(i);
        }
        // curr_kanjis = chp_1_kanji;
        curr_words = chp_1_words;
        console.log(curr_kanjis)
        console.log(curr_words)
    }
}

//Called once the host has started the game.
function game_setup() {
    canPaint = false;
    document.getElementById("pregame_screen").style.display = "none";
    document.getElementById("game_screen").style.display = "flex";
    var board = canvas.getBoundingClientRect();
    offsetX = board.left;
    offsetY = board.top;
    let room_arr = room.info().members;
    for (let i = 0; i < room_arr.length; i++) {
        document.getElementsByClassName("game_name")[i].innerHTML = room_arr[i].user.displayName;
        document.getElementsByClassName("game_name_img")[i].style.display = "block";
    }

    if (create) { //setting up the first round of the game
        for (let i = 0; i < curr_kanjis.length; i++) {
            let setup_arr = [curr_words[curr_kanjis[i]].length / 3];
            total_questions += setup_arr[0];
            if (curr_words[curr_kanjis[i]][1] == "") {
                total_questions--;
            }
            chosen_words.push(setup_arr);
        }

        //BASICALLY DO THIS EVERYTIME YOU MOVE TO NEXT ROUND
        choose_rng();
        model.elementAt("kanji_rng").value(random_kanji_index);
        model.elementAt("word_rng").value(random_word_index);
        let shown_kanji = curr_words[curr_kanjis[random_kanji_index]][random_word_index * 3];
	    chosen_words[random_kanji_index].push(shown_kanji);
        select_random_player();
        model.elementAt("current_drawer").value(current_drawer);
        if (current_drawer == original_username) {
            document.getElementById("game_kana").innerHTML = curr_words[curr_kanjis[random_kanji_index]][random_word_index * 3 + 1];
            document.getElementById("game_english").innerHTML = curr_words[curr_kanjis[random_kanji_index]][random_word_index * 3 + 2];
            canPaint = true;
        }
        document.getElementById("overlay_text").innerHTML = current_drawer + " will draw!";
    }

    setTimeout(remove_overlay, 3000);
}

function select_random_player() {
    let room_arr = room.info().members;
    let room_length = room_arr.length;
    let old_length = random_player_order.length;
    while (random_player_order.length == old_length) {
        if (random_player_order.length == room_length) {
            random_player_order.splice(0, random_player_order.length);
        }
        let num = Math.floor(Math.random() * room_length);
        if (num < MAX_PLAYERS && random_player_order.indexOf(num) == -1) {
            random_player_order.push(num);
            current_drawer = room_arr[num].user.displayName;
        } else if (random_player_order.length == 0) {
            random_player_order.push(0);
            current_drawer = room_arr[0].user.displayName;
        }
    }
}

function remove_overlay() {
    document.getElementById("drawing_overlay").style.display = "none";
    if (create) {
        // console.log("CHOSEN KANJI! " + curr_words[curr_kanjis[random_kanji_index]][random_word_index * 3])
        host_timer = setInterval(function() {timer()}, 1000);
    }
}

function timer() {
    seconds_remaining--;
    document.getElementById("timer").innerHTML = seconds_remaining;
    model.elementAt("timer").value(seconds_remaining);
    if (seconds_remaining == 0) {
        console.log("Timer stopped!")
        clearInterval(host_timer);
        seconds_remaining = MAX_TIME;
        // next_round();
    }
    return;
}

// function next_round() {

// }

//ALL STUFF FOR THE GAME ALGORITHM
var quizzing = false;
var current_question = 1;
var total_questions = 0;
var finished_indexes = new Set([]);
var chosen_words = [];
var random_kanji_index;
var random_word_index;
var kanji_index = 0;
var word_index = 0;

function choose_rng() {
	random_word_index = -1;
	while (random_word_index == -1 && finished_indexes.size != curr_kanjis.length) {
		random_kanji_index = random_kanji_rng();
		if (curr_words[curr_kanjis[random_kanji_index]].length / 3 == 1) {
			finished_indexes.add(random_kanji_index);
			random_word_index = -2; //TODO pretty duct tapey, maybe find a better solution?
			break;
		}
		if(chosen_words[random_kanji_index][0] == chosen_words[random_kanji_index].length - 1) {
			random_word_index = -1;
			finished_indexes.add(random_kanji_index);
			continue;
		}
		random_word_index = random_word_rng(random_kanji_index);
	}
}

function random_kanji_rng() {
	let random_index = -1;
	let find_new_num = true;
	let tried_nums = new Set([-1]);
	while (find_new_num) {
		let old_size = tried_nums.size;
		while (old_size == tried_nums.size) {
			random_index = Math.floor(Math.random() * curr_kanjis.length)
			tried_nums.add(random_index);
		}
		find_new_num = finished_indexes.has(random_index);
	}
	return random_index;
}

function random_word_rng(random_kanji) {
	let find_new_num = true;
	let random_index = -1;
	let tried_nums = new Set([-1]);
	while (find_new_num) {
		let old_size = tried_nums.size;
		while (old_size == tried_nums.size) {
			random_index = Math.floor(Math.random() * curr_words[curr_kanjis[random_kanji_index]].length / 3)
			tried_nums.add(random_index);
			//IF THAT WORD ARRAY HAS AN ARRAY THAT INCLUDES THE SAME EXACT KANJI TWICE BUT WITH DIFFERENT MEANINGS, THIS WILL
			//INFINITE LOOP! DON'T DO THAT!!!
		}
		if (!chosen_words[random_kanji].includes(curr_words[curr_kanjis[random_kanji_index]][random_index * 3]) && curr_words[curr_kanjis[random_kanji_index]][random_index * 3 + 1] == '') {

			chosen_words[random_kanji].push(curr_words[curr_kanjis[random_kanji_index]][random_index * 3]);
			if(chosen_words[random_kanji][0] == chosen_words[random_kanji].length - 1) {
				random_index = -1;
				finished_indexes.add(random_kanji);
				break;
			}
		}

		find_new_num = chosen_words[random_kanji].includes(curr_words[curr_kanjis[random_kanji_index]][random_index * 3]);

	} 

	return random_index;
}




