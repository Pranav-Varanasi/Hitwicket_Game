const socket = new WebSocket('ws://localhost:3000');

let selectedCharacter = null; // Variable to store the selected character

socket.addEventListener('open', () => {
    console.log('Connected to the WebSocket server');
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'init' || data.type === 'update') {
        renderBoard(data.gameState);
        updateTurnIndicator(data.gameState);
        startTurnCountdown();
    } else if (data.type === 'invalid-move') {
        alert('Invalid move: ' + data.message);
    } else if (data.type === 'game-over') {
        alert(`Game Over! ${data.winner} wins!`);
        if (confirm('Do you want to restart the game?')) {
            // Send restart request to the server
            socket.send(JSON.stringify({ type: 'restart' }));
        }
    } else if (data.type === 'turn-timeout') {
        alert('Turn ended due to timeout!');
    }
});

function renderBoard(gameState) {
    const boardDiv = document.getElementById('game-board');
    boardDiv.innerHTML = ''; // Clear the board

    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';

            const character = findCharacterAtPosition(gameState, row, col);
            if (character) {
                cell.textContent = character.type;
                if (character.type === selectedCharacter) {
                    cell.style.backgroundColor = 'yellow'; // Highlight selected character
                }
            }

            cell.addEventListener('click', () => {
                if (!selectedCharacter) {
                    // Select the character if none is selected
                    const char = findCharacterAtPosition(gameState, row, col);
                    if (char) {
                        selectedCharacter = char.type;
                        renderBoard(gameState); // Re-render the board to highlight selection
                    }
                } else {
                    handleCellClick(row, col);
                }
            });

            boardDiv.appendChild(cell);
        }
    }
}

function updateTurnIndicator(gameState) {
    const turnIndicator = document.getElementById('turn-indicator');
    if (gameState.players.player1.active) {
        turnIndicator.textContent = "Player 1's Turn";
    } else {
        turnIndicator.textContent = "Player 2's Turn";
    }
}

function handleCellClick(row, col) {
    if (!selectedCharacter) {
        alert('Select a character first.');
        return;
    }

    const move = {
        type: 'move',
        player: getCurrentPlayer(),
        from: { character: selectedCharacter },
        to: { x: row, y: col }
    };
    socket.send(JSON.stringify(move));

    selectedCharacter = null; // Deselect the character after the move
}

function getCurrentPlayer() {
    const turnIndicatorText = document.getElementById('turn-indicator').textContent;
    return turnIndicatorText.includes("Player 1") ? 'player1' : 'player2';
}

function startTurnCountdown() {
    let timeLeft = 30;
    const timerDiv = document.getElementById('timer');
    
    const countdownInterval = setInterval(() => {
        timeLeft--;
        timerDiv.textContent = `Time Left: ${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function findCharacterAtPosition(gameState, row, col) {
    for (const player in gameState.players) {
        for (const char in gameState.players[player].characters) {
            const character = gameState.players[player].characters[char];
            if (character.x === row && character.y === col) {
                return character;
            }
        }
    }
    return null;
}

