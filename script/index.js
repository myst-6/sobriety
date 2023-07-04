const chess = new Worker("./script/chess.js");
const chr = String.fromCharCode;
let flipped = false;
let turn = WHITE;
let chessBoard = initialBoard;

const captureSound = new Audio("http://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3");
const moveSound = new Audio("http://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3");
const checkSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3");
const checkmateSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3");
const castleSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3");
const promoteSound = new Audio("https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/promote.mp3");

// create a div with a certain class name and textContent
function createDiv(className = "", textContent = "") {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = textContent;
    return div;
}

// create a custom event with a certain type and cell   
function createEvent(type, cell) {
    const ev = new CustomEvent(type, {detail: {cell}});
    return ev;
}

// fill the board with a grid of squares
// draw from white's POV
function populateBoard() {
    
    const board = document.querySelector(".board");
    for (const cell of document.querySelectorAll(".cell")) board.removeChild(cell);
    for (let row=8,i=0; row>=1; row--,i++) {
        for (let col=97,j=0; col<=104; col++,j++) {
            const cell = createDiv("cell");
            // colour each cell a different colour
            if ((row + col) % 2 == 1) {
                cell.classList.add("white");
            } else {
                cell.classList.add("black");
            }
            // the first row contains the column letters
            if (!flipped) {
                if (row == 1) {
                    const letter = createDiv("letter", chr(col));
                    cell.appendChild(letter);
                }
                // the first column contains the row numbers
                if (col == 97) {
                    const number = createDiv("number", row);
                    cell.appendChild(number);
                }
            } else {
                if (row == 1) {
                    const letter = createDiv("letter", chr(201-col));
                    cell.appendChild(letter);
                }
                // the first column contains the row numbers
                if (col == 97) {
                    const number = createDiv("number", 8 - row + 1);
                    cell.appendChild(number);
                }
            }
            
            // identify the cell with its coordinate
            cell.id = chr(col) + row;
            board.appendChild(cell);
            // add lots of event listeners
            cell.addEventListener("click", () => {
                const isLegal = cell.classList.contains("legal-move");
                if (isLegal) {
                    const ev = createEvent("celldrop", cell);
                    document.dispatchEvent(ev);
                } else {
                    if (!flipped) {
                        if ((chessBoard[i][j] & turn) == 0) return false;
                    } else {
                        if ((chessBoard[7-i][7-j] & turn) == 0) return false;
                    }
                    const ev = createEvent("cellstart", cell);
                    ev.detail.persist = false;
                    document.dispatchEvent(ev);
                }
            });
            cell.addEventListener("dragstart", (e) => {
                if (!flipped) {
                    if ((chessBoard[i][j] & turn) == 0) {
                        e.preventDefault();
                        return false;
                    }
                } else {
                    if ((chessBoard[7-i][7-j] & turn) == 0) {
                        e.preventDefault();
                        return false;
                    }
                }
                const ev = createEvent("cellstart", cell);
                ev.detail.persist = true;
                document.dispatchEvent(ev);
            });
            cell.addEventListener("dragover", (ev) => {
                ev.preventDefault();
                return false;
            });
            cell.addEventListener("dragenter", () => {
                cell.classList.add("over");
            });
            cell.addEventListener("dragleave", () => {
                cell.classList.remove("over");
            });
            cell.addEventListener("drop", () => {
                const isLegal = cell.classList.contains("legal-move");
                cell.classList.remove("over");
                if (isLegal) {
                    const ev = createEvent("celldrop", cell);
                    document.dispatchEvent(ev);
                }
            });
        }
    }
    chess.postMessage(["evaluate", WHITE]);
    chess.postMessage(["getDepth"]);
}

// create a div with a piece in it
function createPiece(piece) {
    const div = createDiv("piece");
    if (piece != "") {
        if ((piece & EMPTY) == 0) {
            const img = document.createElement("img");
            img.src = "./img/" + pieceToString(piece) + ".png";
            img.alt = "TODO";
            img.toggleAttribute("draggable");
            div.appendChild(img);
        }
        if ((piece & (KING | turn)) == (KING | turn)) {
            if (new Chess(chessBoard).inCheck(turn)) {
                div.classList.add("king-check");
            } else {
                div.classList.add("king-turn");
            }
        }
        div.classList.add(piece);
    } else {
        div.classList.add("empty");
    }
    return div;
}

function drawBoard(board) {
    if (!flipped) {
        drawBoardWhite(board);
    } else {
        drawBoardBlack(board);
    }
}

// draw a chess board from white's POV
function drawBoardWhite(board) {
    for (let row=8; row>=1; row--) {
        for (let col=97; col<=104; col++) {
            const cell = document.querySelector("#" + chr(col) + row);
            const piece = createPiece(board[8-row][col-97]);
            cell.appendChild(piece);
        }
    }
}

// draw a chess board from black's POV
function drawBoardBlack(board) {
    for (let row=1; row<=8; row++) {
        for (let col=97; col<=104; col++) {
            const cell = document.querySelector("#" + chr(col) + row);
            const piece = createPiece(board[row-1][104-col]);
            cell.appendChild(piece);
        }
    }
}

// delete all pieces
function clearBoard() {
    for (let row=8; row>=1; row--) {
        for (let col=97; col<=104; col++) {
            const cell = document.querySelector("#" + chr(col) + row);
            const piece = cell.querySelector(".piece");
            if (piece) cell.removeChild(piece)
        }
    }
}

// handle the movement of pieces
let selected = "";
document.addEventListener("cellstart", (ev) => {
    const cell = ev.detail.cell;
    // unhighlight old legal moves
    for (const el of document.querySelectorAll(".legal-move")) {
        el.classList.remove("legal-move");
    }
    if (selected != "") {
        document.querySelector("#" + selected).classList.remove("selected");
    }
    if (selected != cell.id || ev.detail.persist) {
        selected = cell.id;
        if (!cell.querySelector(".piece").classList.contains("empty")) {
            document.querySelector("#" + selected).classList.add("selected");
            // highlight legal moves
            const legalMoves = new Chess(chessBoard).legalMoves(turn);
            for (const move of legalMoves) {
                console.log(flipped);
                const [xi, xj] = flipped ? Chess.flipIJ(move[0]) : move[0];
                if (Chess.ijCoord([xi, xj]) == cell.id) {
                    const [yi, yj] = flipped ? Chess.flipIJ(move[1]) : move[1];
                    // highlight these squares
                    const square = document.querySelector("#" + Chess.ijCoord([yi, yj]));
                    square.classList.add("legal-move");
                    square["move"] = move;
                }
            }
        }
    } else {
        selected = "";
    }
});

function makeMove(move) {
    console.log('making move',move);
    chess.postMessage(["makeMove", ...move]);
    chess.postMessage(["turn"]);
    chess.postMessage(["getBoard"]);
    chess.postMessage(["getStack"]);
    chess.postMessage(["getPoints"]);
    chess.postMessage(["evaluate", WHITE]);
    chess.postMessage(["getDepth"]);
}
document.addEventListener("celldrop", (ev) => {
    const targetCell = ev.detail.cell;
    const originalCell = document.querySelector("#" + selected);
    originalCell.classList.remove("selected");
    if (targetCell == originalCell) return;
    // unhighlight old legal moves
    for (const el of document.querySelectorAll(".legal-move")) {
        el.classList.remove("legal-move");
    }
    makeMove(targetCell["move"]);
});

function pieceToCode(piece) {
    if (piece & PAWN) return "";
    if (piece & KNIGHT) return "N";
    if (piece & BISHOP) return "B";
    if (piece & ROOK) return "R";
    if (piece & QUEEN) return "Q";
    if (piece & KING) return "K";
    else return piece;
}

function moveList(stack) {
    let out = "";
    let counter = 0;
    for (let i=0; i<stack.length; i++) {
        const [start, end] = stack[i];
        if (counter % 2 == 0) out += `${Math.floor(counter / 2) + 1}. `;
        if (start[3] & CASTLE_KINGSIDE) {
            out += "O-O";
        } else if (start[3] & CASTLE_QUEENSIDE) {
            out += "O-O-O";
        } else {
            out += pieceToCode(start[2]);
            out += Chess.ijCoord(start);
            if (start[3] & TAKE) out += "x";
            out += Chess.ijCoord(end);
        }
        if (start[3] & CHECK) {
            if (i == stack.length-1 && new Chess(chessBoard).legalMoves(turn).length == 0) {   
                out += "#";
                start[3] |= CHECKMATE;
            }
            else out += "+";
        }
        if (counter % 2 == 1) out += "<br>";
        else out += " ";
        counter++;
    }
    
    
    if (stack[stack.length - 1][0][3] & CHECKMATE) {
        checkmateSound.play();
        setTimeout(() => chess.postMessage(["endGame"]), 500);
    } else if (stack[stack.length - 1][0][3] & CHECK) {
        checkSound.play();
    } else if (stack[stack.length - 1][0][3] & TAKE) {
        captureSound.play();
    } else  {
        moveSound.load();
        console.log("vol",moveSound.volume);
        moveSound.play();
    }
    return out;
}

populateBoard();
drawBoard(initialBoard);

const off = Array(8).fill(0);
let calc = false;
function computerMove() {
    if (calc) return;
    // add animation
    calc = true;
    document.querySelectorAll("button").forEach(button => button.classList.add("disabled"));
    document.querySelectorAll("#title span").forEach(span => span.classList.add("waveTextAnimated"));
    chess.postMessage(["chooseMove"]);
}
function flipBoard() {
    if (calc) return;
    flipped = !flipped;
    populateBoard();
    chess.postMessage(["getBoard"]);
}

chess.onmessage = (ev) => {
    const [f, result] = ev.data;
    console.log(f,result);


    if (f == "evaluate") {
        const e = document.querySelector("#eval");
        e.textContent = result.toFixed(2);
    }

    if (f == "turn") {
        turn = result;
        document.querySelector("#turn").textContent = result & WHITE ? "White" : "Black";
    }

    if (f == "getPoints") {
        document.querySelector("#material").textContent = result;
    }

    if (f == "getDepth") {
        document.querySelector("#depth").textContent = result;
    }

    if (f == "chooseMove") {
        for (let i=0; i<8; i++) off[i] = 0;
        document.querySelectorAll("#title span").forEach((span, i) => {
            const listener = () => {
                if (i == 0 || off[i-1] == 1) {
                    span.classList.remove("waveTextAnimated");
                    span.removeEventListener("animationiteration", listener);
                    off[i] = 1;
                    if (i == 7) {
                        calc = false;
                        document.querySelectorAll("button").forEach(button => button.classList.remove("disabled"));
                    }
                }
            };
            span.addEventListener("animationiteration", listener);
        });
        if (result == null) {
            chess.postMessage(["endGame"])
        } else 
        makeMove(result);
    }

    if (f == "getStack") {
        document.querySelector("#movelist").innerHTML = moveList(result);
    }
    
    if (f == "getBoard") {
        chessBoard = result;
        clearBoard();
        drawBoard(result);
    }

    if (f == "endGame") {
        alert(`Checkmate, ${result % 2 == 0 ? "Black" : "White"} wins!`);
    }

    if (f == "copyPGN") {
        const data = moveList(result).split("<br>").join("\n");
        navigator.clipboard.writeText(data);
    }
};

function undoMove() {
    if (calc) return;
    chess.postMessage(["undoMove"]);
    chess.postMessage(["turn"]);
    chess.postMessage(["getBoard"]);
    chess.postMessage(["getStack"]);
    chess.postMessage(["getPoints"]);
    chess.postMessage(["evaluate", WHITE]);
}

function loadPGN() {
    const pgn = window.prompt("Paste PGN here");
    chess.postMessage(["loadGame", pgn]);
    chess.postMessage(["turn"]);
    chess.postMessage(["getBoard"]);
    chess.postMessage(["getStack"]);
    chess.postMessage(["getPoints"]);
    chess.postMessage(["evaluate", WHITE]);
}

function copyPGN() {
    chess.postMessage(["copyPGN"]);
}