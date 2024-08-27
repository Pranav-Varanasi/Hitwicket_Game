const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

const initialGameState = {
    board: Array(5).fill(null).map(() => Array(5).fill(null)),
    players: {
        player1: {
            characters: {
                hero1: { x: 0, y: 0, type: 'hero1' },
                hero2: { x: 1, y: 0, type: 'hero2' },
                pawn1: { x: 2, y: 0, type: 'pawn' },
                pawn2: { x: 3, y: 0, type: 'pawn' },
                pawn3: { x: 4, y: 0, type: 'pawn' }
            },
            active: true
        },
        player2: {
            characters: {
                hero1: { x: 0, y: 4, type: 'hero1' },
                hero2: { x: 1, y: 4, type: 'hero2' },
                pawn1: { x: 2, y: 4, type: 'pawn' },
                pawn2: { x: 3, y: 4, type: 'pawn' },
                pawn3: { x: 4, y: 4, type: 'pawn' }
            },
            active: false
        }
    }
};

let gameState = JSON.parse(JSON.stringify(initialGameState));
let turnTimer;
const TURN_TIME_LIMIT = 30 * 1000; // 30 seconds

wss.on('connection', (ws) => {
    console.log('A new client connected');

    // Send the initial game state
    ws.send(JSON.stringify({ type: 'init', gameState }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'move') {
            const { player, from, to } = data;

            // Ensure it's the player's turn
            if (!gameState.players[player].active) {
                ws.send(JSON.stringify({ type: 'invalid-move', message: 'Not your turn!' }));
                return;
            }

            const character = gameState.players[player].characters[from.character];
            if (character && isValidMove(character, to)) {
                if (isWinningMove(character, to)) {
                    // Declare the winner
                    broadcast(JSON.stringify({ type: 'game-over', winner: player }));
                    gameState = JSON.parse(JSON.stringify(initialGameState)); // Reset game state
                    clearTimeout(turnTimer); // Stop the timer when the game ends
                } else {
                    // Update character position
                    character.x = to.x;
                    character.y = to.y;

                    // Switch turns
                    gameState.players.player1.active = !gameState.players.player1.active;
                    gameState.players.player2.active = !gameState.players.player2.active;

                    // Broadcast updated game state
                    broadcast(JSON.stringify({ type: 'update', gameState }));

                    // Restart the turn timer for the new player's turn
                    startTurnTimer();
                }
            } else {
                ws.send(JSON.stringify({ type: 'invalid-move', message: 'Invalid move!' }));
            }
        } else if (data.type === 'restart') {
            // Handle restart request
            gameState = JSON.parse(JSON.stringify(initialGameState));
            broadcast(JSON.stringify({ type: 'init', gameState }));
            startTurnTimer();
        }
    });

    ws.on('close', () => {
        console.log('A client disconnected');
    });

    // Start the timer for the first player's turn
    startTurnTimer();
});

function startTurnTimer() {
    clearTimeout(turnTimer);
    turnTimer = setTimeout(() => {
        endTurnDueToTimeout();
    }, TURN_TIME_LIMIT);
}

function endTurnDueToTimeout() {
    // Switch turns if a player runs out of time
    gameState.players.player1.active = !gameState.players.player1.active;
    gameState.players.player2.active = !gameState.players.player2.active;

    // Notify players of the timeout
    broadcast(JSON.stringify({ type: 'turn-timeout' }));

    // Restart the timer for the new player's turn
    startTurnTimer();

    // Broadcast updated game state
    broadcast(JSON.stringify({ type: 'update', gameState }));
}

function isValidMove(character, to) {
    // Basic boundaries check
    if (to.x < 0 || to.x >= 5 || to.y < 0 || to.y >= 5) {
        return false;
    }

    // Check if destination cell is occupied (only if it's an enemy piece)
    const destination = findCharacterAtPosition(gameState, to.x, to.y);
    if (destination && destination.type === character.type) {
        return false;
    }

    // Define movement rules based on character type
    switch (character.type) {
        case 'hero1':
            return Math.abs(to.x - character.x) <= 1 && Math.abs(to.y - character.y) <= 1;
        case 'hero2':
            return (to.x === character.x || to.y === character.y) &&
                   (Math.abs(to.x - character.x) + Math.abs(to.y - character.y)) === 1;
        case 'pawn':
            // Pawns can move forward by 1 cell, or 2 cells on their first move
            const isInitialMove = character.y === 0 ? to.y === 1 : character.y === 4 ? to.y === 3 : false;
            const isForwardMove = to.y === character.y + 1 && to.x === character.x;
            return isForwardMove || isInitialMove;
        default:
            return false;
    }
}

function isWinningMove(character, to) {
    // Win condition: a pawn reaches the opponent's starting row
    if (character.type === 'pawn' && ((character.y === 4 && to.y === 0) || (character.y === 0 && to.y === 4))) {
        return true;
    }
    return false;
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

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

console.log('Server is running on ws://localhost:3000');
