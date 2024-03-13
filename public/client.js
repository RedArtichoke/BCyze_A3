// Store and register player ID (to determine player 1 and player 2 locally)
let playerID; 
// Store audio
let clickSound, winSound, loseSound, drawSound;

// When window loads
window.onload = function() {
    // Array of background SVGs
    let backgrounds = ['haikei-bg1.svg', 'haikei-bg2.svg', 'haikei-bg3.svg', 'haikei-bg4.svg', 'haikei-bg5.svg', 'haikei-bg6.svg'];

    // Randomly select a background
    let randomBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];

    // Set the background
    document.querySelector('.background').style.backgroundImage = 'url(' + randomBackground + ')';
};

// Wait until DOM content is loaded
document.addEventListener('DOMContentLoaded', function () {
    // After loading, store / load data
    clickSound = document.getElementById("click");
    winSound = document.getElementById("win");
    loseSound = document.getElementById("lose");
    const rulesDiv = document.getElementById('rules');
    drawSound = document.getElementById("chargedAttack");

    // Wait for user to click on the rules
    rulesDiv.addEventListener('click', () => {
        // Hide rules
        rulesDiv.style.display = 'none';
    });

    // Load socket
    let socket = io();

    // When a player is being assigned (from the server js)
    socket.on('player assignment', function(msg) {
        // Ternary assign either player 1 or player 2
        playerID = msg.includes('1') ? '1' : '2';

        document.getElementById('playerStatus').textContent = msg;
        // Red button for testing connections between users
        //document.getElementById('makeRedButton').style.display = 'block';
        document.getElementById('attackButton').style.display = 'block';
        document.getElementById('guardButton').style.display = 'block';
        document.getElementById('feintButton').style.display = 'block';
        document.getElementById('chargeButton').style.display = 'block';
    });

    // If lobby is full, does not allow others in
    socket.on('lobby full', function(msg) {
        document.getElementById('lobbyStatus').textContent = msg;
    });

    // // Apply red background for testing
    // socket.on('changeColor', function(color) {
    //     document.body.style.backgroundColor = color;
    //     setTimeout(function() {
    //         document.body.style.backgroundColor = '';
    //     }, 1000);
    // });

    // When health bars need to be updated by the server
    socket.on('updateHealth', function(data) {
        // Check if player matches
        const isPlayer = data.player === playerID;
        // Determine which health bar is which
        const playerHealthFill = '.health-bar-fill.player';
        const enemyHealthFill = '.health-bar-fill.enemy';
    
        // Load and store health data
        const currentHealth = data.health;
        const maxHealth = 3;
        const healthRatio = (currentHealth / maxHealth) * 100;
    
        if (isPlayer) {
            // Update the player's health bar
            document.querySelector(playerHealthFill).style.width = healthRatio + '%';
        } else {
            // Update the enemy's health bar
            document.querySelector(enemyHealthFill).style.width = healthRatio + '%';
            // Update the enemy's image to also reflect enemy health
            updateEnemyImage(data.health);
        }

        // Because "updateHealth" is called whenever a turn is finished, might as well reset all buttons here, too
        let buttons = document.querySelectorAll('button');
        buttons.forEach(function(btn) {
            btn.classList.remove('selected');
        });
    });
    
    // When game ends
    socket.on('gameOver', function(data) {
        // Message to be displayed in game-end window as a title
        let resultMessage;
        // If it's a draw
        if (data.winner === 'draw') {
            // Tells client that match ended in a draw
            drawSound.play();
            resultMessage = "DRAW";
        } 
        // If player won
        else if (data.winner === playerID) {
            // Tells client they won
            winSound.play();
            resultMessage = "YOU WIN";
        } 
        // Only other alternative is losing
        else {
            // Tells client they lost
            loseSound.play();
            resultMessage = "YOU LOSE";
        }
        // Update match results
        document.getElementById('resultsMessage').textContent = resultMessage;
        document.getElementById('resultsPanel').style.display = 'block';
    });

    // Reset game
    socket.on('resetGame', function() {
        resetGameUI();
    });

    // // When red button is clicked, make red
    // document.getElementById('makeRedButton').addEventListener('click', function() {
    //     socket.emit('makeRed');
    // });

    // When attack button is clicked
    document.getElementById('attackButton').addEventListener('click', function() {
        // Create clone of attack audio (so it can be spammed)
        let audio = new Audio("attack.mp3");

        updateButtons(document.getElementById('attackButton'));

        audio.play();
        socket.emit('attack');
    });

    // When guard button is clicked
    document.getElementById('guardButton').addEventListener('click', function() {
        // Create clone of blocked audio (so it can be spammed)
        let audio = new Audio("blocked.mp3");

        updateButtons(document.getElementById('guardButton'));

        audio.play();
        socket.emit('guard');
    });

    // When feint button is clicked
    document.getElementById('feintButton').addEventListener('click', function() {
        // Create clone of feint audio (so it can be spammed)
        let audio = new Audio("feint.mp3");
        
        updateButtons(document.getElementById('feintButton'));

        audio.play();
        socket.emit('feint');
    });

    // When charge button is clicked
    document.getElementById('chargeButton').addEventListener('click', function() {
        // Create clone of charge audio (so it can be spammed)
        let audio = new Audio("charge.mp3");
        
        updateButtons(document.getElementById('chargeButton'));

        audio.play();
        socket.emit('charge');
    });

    // When play again button is clicked
    document.getElementById('playAgainButton').addEventListener('click', function() {
        // Toggle "selected" when play button is pressed, so player knows it's toggled
        document.getElementById('playAgainButton').classList.add('selected');
        socket.emit('resetGame');
    });    
});

// Reset game
function resetGame() {
    // Hide play again button
    document.getElementById('playAgainButton').style.display = 'none';
    // This is unnecessary text simply for E-reader and testing purposes
    // document.getElementById('playerHealth1').textContent = 'Player 1\'s Health: 3';
    // document.getElementById('playerHealth2').textContent = 'Player 2\'s Health: 3';
    // Results panel is hidden
    document.getElementById('resultsPanel').style.display = 'none';
}

// Update button selections so selected one is toggled while others are hidden
function updateButtons(button) {
    // Remove 'selected' class from all buttons
    let buttons = document.querySelectorAll('button');
    buttons.forEach(function(btn) {
      btn.classList.remove('selected');
    });
  
    // Add 'selected' class to the clicked button
    button.classList.add('selected');
  }
  
// Play a click noise when buttons are pressed
function playClick() {
    clickSound.play();
}

// Reset game's UI
function resetGameUI() {
    // Hide the results panel if it's still visible
    document.getElementById('resultsPanel').style.display = 'none';
    // Reset enemy image to full "health"
    updateEnemyImage(3);
}

// Update enemy's image
function updateEnemyImage(health) {
    let imageSrc;
    switch (health) {
        // Full health
        case 3:
            // Whenever new game starts, makes all buttons visible
            document.getElementById('attackButton').style.display='block';
            document.getElementById('feintButton').style.display='block';
            document.getElementById('guardButton').style.display='block';
            document.getElementById('chargeButton').style.display='block';
            document.getElementById('enemyImage').style.display = 'block';
            imageSrc = 'happy.png';
            break;
        // 2 health
        case 2:
            imageSrc = 'angry.png';
            break;
        // 1 health
        case 1:
            imageSrc = 'scared.png';
            break;
        // When player is "dead"
        default:
            // Hide all buttons when player is dead
            document.getElementById('attackButton').style.display='none';
            document.getElementById('feintButton').style.display='none';
            document.getElementById('guardButton').style.display='none';
            document.getElementById('chargeButton').style.display='none';
            document.getElementById('enemyImage').style.display = 'none';
            imageSrc = 'scared.png';
            break;
    }
    // Update the actual image
    document.getElementById('enemyImage').src = imageSrc;
}

