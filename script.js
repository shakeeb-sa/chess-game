// --- CONFIGURATION ---
const SERVER_URL = "http://chess-game-backend--shakeebsaahmed.replit.app"; 
// Example: "https://my-chess-app.glitch.me" or "https://chess.onrender.com"

// --- VARIABLES ---
let socket;
let board = null;
let game = new Chess();
let playerColor = 'white';
let isRegistering = false;
let token = localStorage.getItem('token'); 

// --- DOM ELEMENTS ---
const authScreen = document.getElementById('auth-screen');
const gameContainer = document.getElementById('game-container');
const authBtn = document.getElementById('auth-btn');
const authTitle = document.getElementById('auth-title');
const toggleAuth = document.getElementById('toggle-auth');
const authMsg = document.getElementById('auth-msg');

// --- AUTH LOGIC ---

// Toggle Auth Mode
toggleAuth.addEventListener('click', () => {
    isRegistering = !isRegistering;
    authTitle.innerText = isRegistering ? "Register" : "Login";
    authBtn.innerText = isRegistering ? "Sign Up" : "Let's Play";
    toggleAuth.innerText = isRegistering ? "Have an account? Login" : "New here? Create an account";
    authMsg.innerText = "";
});

// Auth Handler
authBtn.addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(!username || !password) {
        authMsg.innerText = "Please fill in all fields.";
        return;
    }

    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    const endpoint = isRegistering ? '/register' : '/login';

    try {
        const res = await fetch(SERVER_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        authBtn.innerText = isRegistering ? "Sign Up" : "Let's Play";

        if (!res.ok) throw new Error(data.message);

        if (isRegistering) {
            alert("Account created! Please login.");
            toggleAuth.click();
        } else {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            token = data.token;
            initializeGame(data.username);
        }
    } catch (err) {
        authMsg.innerText = err.message;
        authBtn.innerText = "Try Again";
    }
});

// Auto Login check
if (token) {
    initializeGame(localStorage.getItem('username'));
}

function initializeGame(username) {
    authScreen.style.opacity = '0'; // Fade out
    setTimeout(() => {
        authScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        gameContainer.style.animation = 'fadeIn 0.5s ease-out'; // Fade in game
    }, 300);
    
    document.getElementById('user-display-name').innerText = username;
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });

    connectSocket();
}

// --- GAME & SOCKET LOGIC ---

function connectSocket() {
    socket = io(SERVER_URL, {
        auth: { token: token }
    });

    socket.on('connect_error', (err) => {
        authMsg.innerText = "Session expired. Login again.";
        localStorage.clear();
        location.reload();
    });

    socket.on('playerColor', (color) => {
        playerColor = color;
        board.orientation(color);
        updateStatusDisplay(`Game Started! You are ${color.toUpperCase()}.`, true);
        document.getElementById('room-panel').style.display = 'none'; // Hide controls during game
    });

    socket.on('startGame', (fen) => {
        game.load(fen);
        board.position(fen);
        updateStatus();
    });

    socket.on('move', (move) => {
        game.move(move);
        board.position(game.fen());
        updateStatus();
    });

    // Room Buttons
    document.getElementById('createBtn').onclick = () => {
        const room = document.getElementById('roomIdInput').value;
        if(room) {
            socket.emit('create_room', room);
            updateStatusDisplay("Creating room...", false);
        }
    };
    document.getElementById('joinBtn').onclick = () => {
        const room = document.getElementById('roomIdInput').value;
        if(room) {
            socket.emit('join_room', room);
            updateStatusDisplay("Joining room...", false);
        }
    };
    
    // Handle server errors
    socket.on('error', (msg) => {
        alert(msg);
        document.getElementById('room-panel').style.display = 'block';
    });

    initBoard();
}

function updateStatusDisplay(text, active) {
    const el = document.getElementById('status');
    el.innerText = text;
    if(active) {
        el.style.borderLeftColor = '#00cec9';
        el.style.color = '#fff';
    }
}

// --- CHESSBOARD CONFIG ---

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) return false;
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (playerColor === 'black' && piece.search(/^w/) !== -1)) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    socket.emit('move', { roomId: document.getElementById('roomIdInput').value, move: move, fen: game.fen() });
    updateStatus();
}

function onSnapEnd() { board.position(game.fen()); }

function updateStatus() {
    let status = game.turn() === 'b' ? 'Black to move' : 'White to move';
    let isCheck = false;

    if (game.in_checkmate()) status = 'Game over! ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins!';
    else if (game.in_draw()) status = 'Game over! Draw.';
    else if (game.in_check()) {
        status += ' (CHECK!)';
        isCheck = true;
    }

    const el = document.getElementById('status');
    el.innerText = status;
    
    // Visual feedback for turn
    if(isCheck) el.style.borderLeftColor = '#ff7675';
    else el.style.borderLeftColor = (game.turn() === 'w') ? '#fff' : '#2d3436';
}

function initBoard() {
    board = Chessboard('board', {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    // Resize board on window resize
    $(window).resize(board.resize);
}