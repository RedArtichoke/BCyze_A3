// Provided server content
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);

const LISTEN_PORT = 8080;

// Root path storage
const rootPath = __dirname + '/public';

// Player 1 and player 2 = null by default
let playerSlots = {1: null, 2: null};
// Wait for both players to be requesting a reset before starting a new game
let resetRequests = { player1: false, player2: false };
let readyForReset = {}; 

// I don't really understand what this does but it was provided
app.use(express.static(rootPath));

// I also don't really understand this, but:
// https://socket.io/get-started/chat
app.get('/', function (req, res) {
    res.sendFile('index.html', {root: rootPath});
});

// Game state class
let gameState = {
    // Player 1 details (health, action, damage mult)
    player1: { health: 3, action: null, multiplier: 1 },
    // Player 2 details (health, action, damage mult)
    player2: { health: 3, action: null, multiplier: 1 },
    // Turn actions (attack, guard, charge, etc)
    actions: { player1: null, player2: null }
};

// Reset the game's states for new game
function resetGameState() {
    // Reset all values
    gameState.player1.health = 3;
    gameState.player2.health = 3;
    gameState.player1.multiplier = 1;
    gameState.player2.multiplier = 1;
    gameState.actions.player1 = null;
    gameState.actions.player2 = null;
}

// End game and update data to determine winner, loser, draw
function checkGameOver() {
    // Store true if player is dead
    const isPlayer1Dead = gameState.player1.health <= 0;
    const isPlayer2Dead = gameState.player2.health <= 0;

    // If a player is dead
    if (isPlayer1Dead || isPlayer2Dead) {
        // Default to "draw"
        let winner = 'draw';
        // If Player 1 is dead
        if (isPlayer1Dead && !isPlayer2Dead) {
            // Player 2 wins
            winner = '2';
        } 
        // If player 2 is dead
        else if (!isPlayer1Dead && isPlayer2Dead) {
            // Player 1 wins
            winner = '1';
        }
        
        // Emit gameOver call and send the winner for client code to handle
        io.emit('gameOver', { winner: winner });
    }
}

// Apply player actions
function applyActions() {
    // Apply player 1's action
    if (gameState.actions.player1 === 'attack') {
        // If player 2 is guarding, skips (to not deal damage)
        if (gameState.actions.player2 != 'guard')
            // Deal damage relative to multiplier (this handles the "charge" action)
            gameState.player2.health -= 1 * gameState.player1.multiplier;
            // Reset multiplier after attacking
            gameState.player1.multiplier = 1;
    }
    // Heal if opponent isn't attacking this turn
    else if (gameState.actions.player1 === 'feint') {
        // If player is not being attacked and the player does not have max health, heals by 1
        if (gameState.actions.player2 != 'attack' && gameState.player1.health < 3) 
            gameState.player1.health += 1;
    }
    // Charge next attack
    else if (gameState.actions.player1 === 'charge' && gameState.player1.multiplier < 3) {
        gameState.player1.multiplier++;
    }

    // Apply player 2's action
    if (gameState.actions.player2 === 'attack') {
        // If player 1 is guarding, skips (to not deal damage)
        if (gameState.actions.player1 != 'guard')
        // Deal damage relative to multiplier (this handles the "charge" action)
            gameState.player1.health -= 1 * gameState.player2.multiplier;
            // Reset multiplier after attacking
            gameState.player2.multiplier = 1;
    }
    // Heal if opponent isn't attacking this turn
    else if (gameState.actions.player2 === 'feint') {
        // If player is not being attacked and the player does not have max health, heals by 1
        if (gameState.actions.player1 != 'attack' && gameState.player2.health < 3) 
            gameState.player2.health += 1;
    }
    // Charge next attack
    else if (gameState.actions.player2 === 'charge' && gameState.player2.multiplier < 3) {
        gameState.player2.multiplier++;
    }

    // Check for game over condition
    checkGameOver();

    // Emit the health update to all clients
    io.emit('updateHealth', { player: '1', health: gameState.player1.health });
    io.emit('updateHealth', { player: '2', health: gameState.player2.health });
}

// Check if both actions have been made to apply the turn
function checkActions() {
    // Check if both players have chosen an action
    if (gameState.actions.player1 && gameState.actions.player2) {
        // Apply actions
        applyActions();
        // Reset actions for the next turn
        gameState.actions.player1 = null;
        gameState.actions.player2 = null;
    }
}

// When player connects
io.on('connection', (socket) => {
    let assignedSlot = null;
    for (let slot in playerSlots) {
        if (playerSlots[slot] === null) {
            playerSlots[slot] = socket.id;
            assignedSlot = slot;
            break;
        }
    }

    // When it is time to reset the game
    socket.on('resetGame', () => {
        readyForReset[socket.id] = true;

        // Check if all connected players are ready to reset
        if (Object.keys(readyForReset).length === Object.keys(playerSlots).length && 
            Object.values(readyForReset).every(value => value)) {
            
            // Reset server game-wise
            resetGameState(); 

            // Communicate game reset to clients
            io.emit('resetGame');

            // Clear reset info
            readyForReset = {};

            // Emit the health update to all clients
            io.emit('updateHealth', { player: '1', health: gameState.player1.health });
            io.emit('updateHealth', { player: '2', health: gameState.player2.health });
        }
    });

    // Check if a player has had their slot assigned
    if (assignedSlot) {
        // Player assigned (player #)
        socket.emit('player assignment', `Player ${assignedSlot}`);
        // Emit player connected
        io.emit('player connection', `Player ${assignedSlot} connected`);

        // Listen if a player disconnects
        socket.on('disconnect', () => {
            // Tell clients player disconnected
            io.emit('player disconnection', `Player ${assignedSlot} disconnected`);
            // Free up slot
            playerSlots[assignedSlot] = null;
        });

        // Connection testing method
        // socket.on('makeRed', () => {
        //     socket.broadcast.emit('changeColor', 'red');
        // });

        // Handle player attack
        socket.on('attack', () => {
            // Identify current player with ID
            const currPlayer = `player${assignedSlot}`;
            gameState.actions[currPlayer] = 'attack'; // Store the action
        
            checkActions();
        });

        // Handle player guard
        socket.on('guard', () => {
            // Identify current player with ID
            const currPlayer = `player${assignedSlot}`;
            gameState.actions[currPlayer] = 'guard'; // Store the action

            checkActions();
        });

        // Handle player feint
        socket.on('feint', () => {
            // Identify current player with ID
            const currPlayer = `player${assignedSlot}`;
            gameState.actions[currPlayer] = 'feint';

            checkActions();
        });
       
        // Handle player charge
        socket.on('charge', () => {
            // Identify current player with ID
            const currPlayer = `player${assignedSlot}`;
            gameState.actions[currPlayer] = 'charge'

            checkActions();
        });

    } else {
        // Lobby is full, tell users
        socket.emit('lobby full', 'LOBBY FULL');
        socket.disconnect();
    }
});

// Provided code to announce what port is being listened on
server.listen(LISTEN_PORT, () => {
    console.log("Listening on port: " + LISTEN_PORT);
});
