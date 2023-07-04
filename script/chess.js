const par = x => x >> 1;
const lc = x => (x << 1);
const rc = x => (x << 1) & 1;




const BRANCH = 99;
const DEPTH = 3;

const TAKE = 1 << 0;
const MOVE = 1 << 1;
const CASTLE_KINGSIDE = 1 << 2;
const CASTLE_QUEENSIDE = 1 << 3;
const EN_PASSANT = 1 << 4;
const CHECK = 1 << 5;
const CHECKMATE = 1 << 6;

const EMPTY = 1 << 0;
const BLACK = 1 << 1;
const WHITE = 1 << 2;
const PAWN = 1 << 3;
const KNIGHT = 1 << 4;
const BISHOP = 1 << 5;
const ROOK = 1 << 6;
const QUEEN = 1 << 7;
const KING = 1 << 8;
const MOVED = 1 << 9;
const ANY = BLACK | WHITE | MOVED;


function pieceToString(piece) {
    let str = piece & WHITE ? "w" : "b";
    str += "_";
    if (piece & PAWN) str += "pawn";
    if (piece & KNIGHT) str += "knight";
    if (piece & BISHOP) str += "bishop";
    if (piece & ROOK) str += "rook";
    if (piece & QUEEN) str += "queen";
    if (piece & KING) str += "king";
    return str;
}

const initialBoard = [
    [BLACK | ROOK, BLACK | KNIGHT, BLACK | BISHOP, BLACK | QUEEN, BLACK | KING, BLACK | BISHOP, BLACK | KNIGHT, BLACK | ROOK],
    [BLACK | PAWN, BLACK | PAWN, BLACK | PAWN, BLACK | PAWN, BLACK | PAWN, BLACK | PAWN, BLACK | PAWN, BLACK | PAWN],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY],
    [WHITE | PAWN, WHITE | PAWN, WHITE | PAWN, WHITE | PAWN, WHITE | PAWN, WHITE | PAWN, WHITE | PAWN, WHITE | PAWN],
    [WHITE | ROOK, WHITE | KNIGHT, WHITE | BISHOP, WHITE | QUEEN, WHITE | KING, WHITE | BISHOP, WHITE | KNIGHT, WHITE | ROOK]
];

class Chess {
    stack = [];
    board = [];
    evalMemo = new Map();
    legalMemo = new Map();

    constructor(board) {
        if (typeof board == "number") {
            this.board = Array.from({ length: 8 }, () => Array(8).fill(0));
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const s = 10 * (i * 8 + j);
                    const x = board >> BigInt(s);
                    x &= (1n << 10n) - 1n;
                    this.board[i][j] = x;
                }
            }
        } else {
            this.board = board;
        }
    }

    getStack() {
        return this.stack;
    }

    loadGame(pgn) {
        // 1. d2d4 Nb8xc6
        // 2. e2e4 f7f5
        // 3. Bf1xb5 Nc6xd4
        // 4. Qd1xd4
        const pairs = pgn.split("\n");
        const tokens = pairs.reduce((acc, pair) => [...acc, ...pair.split(" ").slice(1, 3)], []);
        for (const token of tokens) {
            let found = false;
            const legalMoves = this.legalMoves(this.turn());
            if (token.startsWith("O")) {
                if (token.length >= 5) {
                    // queenside
                    for (const move of legalMoves) {
                        if (move[0][2] & CASTLE_QUEENSIDE) {
                            this.makeMove(...move);
                            found = true;
                            break;
                        }
                    }
                } else {
                    // kingside
                    for (const move of legalMoves) {
                        if (move[0][2] & CASTLE_KINGSIDE) {
                            this.makeMove(...move);
                            found = true;
                            break;
                        }
                    }
                }
            } else {
                const letters = [...token].filter(x => !/[x+#BNRQK]/.test(x));
                const [xi, xj] = Chess.coordIJ(letters.slice(0, 2));
                const [yi, yj] = Chess.coordIJ(letters.slice(2, 4));
                for (const move of legalMoves) {
                    if (move[0][0] != xi) continue;
                    if (move[0][1] != xj) continue;
                    if (move[1][0] != yi) continue;
                    if (move[1][1] != yj) continue;
                    this.makeMove(...move);
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw new Error("TODO: pgn bad"); // todo
            }
        }
    }

    getBoard() {
        return this.board;
    }

    hash() {
        let h = 0n;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const s = 10 * (i * 8 + j);
                h |= BigInt(this.board[i][j]) << BigInt(s);
            }
        }
        return h;
    }

    // give the squares that a piece can 'see'
    pieceVision([i, j]) {
        const idxs = [];
        const piece = this.board[i][j];

        // helper function, adds positions to idxs
        // and traverses board in a certain direction
        const helper = ([di, dj]) => {
            let xi = i + di, xj = j + dj;
            while (0 <= xi && xi < 8 && 0 <= xj && xj < 8) {
                idxs.push([xi, xj, TAKE | MOVE]);
                if ((this.board[xi][xj] & EMPTY) == 0) break;
                xi += di, xj += dj;
            }
        };

        // rook/queen movement (same col/row)
        if (piece & (ROOK | QUEEN)) {
            helper([+1, 0]);
            helper([-1, 0]);
            helper([0, +1]);
            helper([0, -1]);
        }

        // bishop/queen movement (same diagonal)
        if (piece & (BISHOP | QUEEN)) {
            helper([+1, +1]);
            helper([-1, -1]);
            helper([+1, -1]);
            helper([-1, +1]);
        }

        // knight movement (L-shape)
        if (piece & KNIGHT) {
            for (let di = -2; di <= 2; di++) {
                if (i + di < 0 || i + di >= 8) continue;
                if (di == 0) continue;
                let adj = 3 - Math.abs(di);
                if (j + adj >= 0 && j + adj < 8) idxs.push([i + di, j + adj, MOVE | TAKE]);
                if (j - adj >= 0 && j - adj < 8) idxs.push([i + di, j - adj, MOVE | TAKE]);
            }
        }

        // king movement
        if (piece & KING) {
            for (let di = -1; di <= 1; di++) {
                if (i + di < 0 || i + di >= 8) continue;
                for (let dj = -1; dj <= 1; dj++) {
                    if (di == 0 && dj == 0) continue;
                    if (j + dj < 0 || j + dj >= 8) continue;
                    idxs.push([i + di, j + dj, MOVE | TAKE]);
                }
            }
            // castling

            // NEED TO CHECK SQUARES ARE SAFE IN BETWEEN AND THE SQUARE IS ALSO SAFE
            if ((piece & MOVED) == 0) {
                // check rooks are available and not blocked
                if (piece & WHITE) {
                    if ((this.board[7][0] & (MOVED | EMPTY)) == 0) {
                        // queenside
                        if ((this.board[7][1] & EMPTY)
                            && (this.board[7][2] & EMPTY)
                            && (this.board[7][3] & EMPTY)) {
                            idxs.push([7, 2, CASTLE_QUEENSIDE, 7, 0, 7, 3]);
                        }
                    }
                    if ((this.board[7][7] & (MOVED | EMPTY)) == 0) {
                        // kingside
                        if ((this.board[7][6] & EMPTY)
                            && (this.board[7][5] & EMPTY)) {
                            idxs.push([7, 6, CASTLE_KINGSIDE, 7, 7, 7, 5]);
                        }
                    }
                } else {
                    if ((this.board[0][0] & (MOVED | EMPTY)) == 0) {
                        // queenside
                        if ((this.board[0][1] & EMPTY)
                            && (this.board[0][2] & EMPTY)
                            && (this.board[0][3] & EMPTY)) {
                            idxs.push([0, 2, CASTLE_QUEENSIDE, 0, 0, 0, 3]);
                        }
                    }
                    if ((this.board[0][7] & (MOVED | EMPTY)) == 0) {
                        // kingside
                        if ((this.board[0][5]) & EMPTY
                            && (this.board[0][6]) & EMPTY) {
                            idxs.push([0, 6, CASTLE_KINGSIDE, 0, 7, 0, 5]);
                        }
                    }
                }
            }
        }

        // white pawn movement
        if ((piece & (WHITE | PAWN)) == (WHITE | PAWN)) {
            idxs.push([i - 1, j, MOVE]);
            if (j > 0) idxs.push([i - 1, j - 1, TAKE]);
            if (j < 7) idxs.push([i - 1, j + 1, TAKE]);
            if (i == 6 && this.board[5][j] & EMPTY) idxs.push([i - 2, j, MOVE]);
        }

        // black pawn movement
        if ((piece & (BLACK | PAWN)) == (BLACK | PAWN)) {
            idxs.push([i + 1, j, MOVE]);
            if (j > 0) idxs.push([i + 1, j - 1, TAKE]);
            if (j < 7) idxs.push([i + 1, j + 1, TAKE]);
            if (i == 1 && this.board[2][j] & EMPTY) idxs.push([i + 2, j, MOVE]);
        }

        // remove duplicates
        return [...new Set(idxs.map(x => x.join(",")))].map(x => x.split(",").map(x => +x));
    }

    // make move on a board
    // consisting of pairs of [i, j] coordinates
    // the first in each pair will be moved to the second in each pair
    makeMove(...ij) { // [[start_xy], [end_xy], [start_xy], [end_xy]]

        if (ij.length == 0) return;
        this.stack.push(ij.map(([i, j, f]) => [i, j, this.board[i][j], f]));
        for (let m = 0; m < ij.length; m += 2) {
            const [xi, xj] = ij[m];
            const [yi, yj] = ij[m + 1];
            if (this.board[xi][xj] & EMPTY) throw new Error("cannot move empty square");
            this.board[yi][yj] = this.board[xi][xj] | MOVED;
            // TODO: promotion
            if ((this.board[yi][yj] & (WHITE | PAWN)) == (WHITE | PAWN) && yi == 0) this.board[yi][yj] = WHITE | QUEEN | MOVED;
            if ((this.board[yi][yj] & (BLACK | PAWN)) == (BLACK | PAWN) && yi == 7) this.board[yi][yj] = BLACK | QUEEN | MOVED;
            this.board[xi][xj] = EMPTY;
        }
        if (this.inCheck(this.turn())) {
            this.stack[this.stack.length - 1][0][3] |= CHECK;
        }
    }

    // undo last move on a board
    undoMove() {
        for (const ijk of this.stack.pop()) {
            const [i, j, k] = ijk;
            this.board[i][j] = k;
        }
    }

    classifyMove(move) {
        this.makeMove(...move);
        const flag = this.stack[this.stack.length - 1][0][3];
        this.undoMove();
        return flag;
    }

    // evaluate position
    evaluate(pre, dbg = false) {
        const h = (this.hash() << 10n) + BigInt(this.stack.length) * 8n + BigInt(pre);
        if (this.evalMemo.has(h)) return this.evalMemo.get(h);

        

        /*
        - Check how many pawns each side has. The fewer pawns there are, 
        the more valuable knights and pawns are, and the less valuable the other pieces are.
        - Count up the material.
        - Check how many pieces surround each king.
        - Check which squares are visible from each side.
        - If a square has X pieces from this side and Y from the other,
        its contribution is X^2 - Y^2.
        - Check how many pieces each player has moved.
        - Check how far the pawns have moved.
        - TODO: pawn structures (doubled, isolated etc.)
        - If less than certain amount of pieces, want king near the center. (endgame)
        - If more than certain amount of pieces, want king near the edge. // partially covered by surroundthing
        - count the amount of pieces on black/white squares compared to bishop to evaluate bishop power (b/w) **
        - weight centre pawns more heavily
        */

        let ans = 0;

        // returns between 0.5 and 1.5, depending on how close to the centre the piece is
        // function centreValue(i, j) {
        //     const dist = Math.abs(i - 3.5) ** 2 + Math.abs(j - 3.5) ** 2;
        //     return 1.5 - 1 / (1 + Math.exp(4 - dist));
        // }

        // 2. favour centre pieces - knights, pawns
        // let centre = 0;
        // for (let i = 0; i < 8; i++) {
        //     for (let j = 0; j < 8; j++) {
        //         if ((this.board[i][j] & (KNIGHT | PAWN)) == 0) continue;
        //         let value = centreValue(i, j);
        //         if (this.board[i][j] & KNIGHT) value *= 2;
        //         if ((this.board[i][j] & pre) == 0) value *= -1;
        //         centre += value;
        //     }
        // }
        // ans += centre / (2 + this.stack.length) * 2;

        // 3. check how far the pawns a re

        const pawnPushWeight = 0.2 * (1 + this.stack.length / 30);

        console.log("pawn push weight", pawnPushWeight);

        let pawn = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((this.board[i][j] & PAWN) == 0) continue;
                let value = 0;
                if (this.board[i][j] & WHITE) value = (7 - i) / 7;
                if (this.board[i][j] & BLACK) value = i / 7;
                if ((this.board[i][j] & pre) == 0) value *= -1;
                pawn += value;
            }
        }
        ans += pawn * pawnPushWeight;

        // 4. make the king not want to move off its starting square
        // idea: adjust agility based upon how large the stack is?
        const agilities = {
            [ANY | KNIGHT]: 1,
            [ANY | PAWN]: 1,
            [ANY | BISHOP]: 0.5 + this.stack.length / 80,
            [ANY | QUEEN]: -1 + this.stack.length / 40,
            [ANY | ROOK]: -2 + this.stack.length / 40,
            [ANY | KING]: -3 + this.stack.length / 40,
        };
        let agility = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((this.board[i][j] & MOVED) == 0) continue;
                let value = agilities[this.board[i][j] | ANY];
                if ((this.board[i][j] & pre) == 0) value *= -1;
                agility += value;
            }
        }
        ans += agility * 0.4;



        // 5. piece vision

        // let vision = 0;
        // for (let i=0; i<8; i++) {
        //     for (let j=0; j<8; j++) {
        //         if (this.board[i][j] & EMPTY) continue;
        //         squares += this.pieceVision(i, j).length;
        //         if ((this.board[i][j] & pre) == 0) squares *= -1;
        //         vision += squares / (5 + this.stack.length * 2);

        //     }  
        // }
        // ans += vision * 500;


        // 5. dislike stacked pawns
        let stacked = 0;
        for (let j = 0; j < 8; j++) {
            let whitePawns = 0, blackPawns = 0;
            // take some column
            for (let i = 0; i < 8; i++) {
                if ((this.board[i][j] & PAWN) == 0) continue;
                if (this.board[i][j] & WHITE) whitePawns++;
                if (this.board[i][j] & BLACK) blackPawns++;
            }

            if (whitePawns > 1) stacked -= whitePawns ** 3;
            if (blackPawns > 1) stacked += blackPawns ** 3;
        }
        if (pre & BLACK) stacked *= -1;

        ans += stacked * 0.25;

        // 6. map for each piece and where it wants to go:

        const pawnMap = [[100, 100, 100, 100, 100, 100, 100, 100],
        [25, 25, 25, 25, 25, 25, 25, 25],
        [10, 10, 10, 10, 10, 10, 10, 10],
        [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
        [1, 1, 1.1, 1.85, 1.85, 1.1, 1, 1],
        [1, 1, 1.35, 1.4, 1.4, 1.35, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],   
        [0, 0, 0, 0, 0, 0, 0, 0],];

        const bishopMap = [[0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.6],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [0.7, 1, 1, 1.2, 1.2, 1, 1, 0.7],
        [0.7, 1, 1, 1.2, 1.2, 1, 1, 0.7],
        [0.7, 1, 1.3, 1.3, 1.3, 1.3, 1, 0.7],
        [0.7, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 0.7],
        [0.7, 1.1, 1, 1, 1, 1, 1.1, 0.7],
        [0.6, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.6],];

        const knightMap = [[0.5, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.5],
        [0.75, 1, 1, 1, 1, 1, 1, 0.75],
        [0.75, 1, 1.15, 1.15, 1.15, 1.15, 1, 0.75],
        [0.75, 1, 1.15, 1.4, 1.4, 1.15, 1, 0.75],
        [0.75, 1, 1.15, 1.4, 1.4, 1.15, 1, 0.75],
        [0.75, 1, 1.15, 1.15, 1.15, 1.15, 1, 0.75],
        [0.75, 1, 1, 1, 1, 1, 1, 0.75],
        [0.5, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0.5],];

        const rookMap = [
            [1, 1, 1, 1, 1, 1, 1, 1],
        [1.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 1.5],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [0.7, 1, 1, 1, 1, 1, 1, 0.7],
        [1, 1, 1, 1.2, 1.2, 1, 1, 1],];


        const queenMap = [[0.7, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.7],
        [0.8, 0.9, 1, 1, 1, 1, 0.9, 0.8],
        [0.8, 1, 1.1, 1.2, 1.2, 1.1, 1, 0.8],
        [0.8, 1, 1.2, 1.3, 1.3, 1.2, 1, 0.8],
        [0.8, 1, 1.2, 1.3, 1.3, 1.2, 1, 0.8],
        [0.8, 1, 1.1, 1.2, 1.2, 1.1, 1, 0.8],
        [0.8, 0.9, 1, 1, 1, 1, 0.9, 0.8],
        [0.7, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.7],];

        const kingMap = [[-0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, -0.5],
        [0.8, 0.65, 0.5, 0.5, 0.5, 0.5, 0.65, 0.8],
        [0.8, 0.65, 0.5, 0.5, 0.5, 0.5, 0.65, 0.8],
        [0.8, 0.65, 0.5, 0.3, 0.3, 0.5, 0.65, 0.8],
        [0.8, 0.65, 0.5, 0.3, 0.3, 0.5, 0.65, 0.8],
        [1, 1, 0.8, 0.5, 0.5, 0.8, 1, 1],
        [1.4, 1.4, 1, 1, 1, 1, 1.4, 1.4],
        [1.4, 2.5, 1.4, 1, 1, 1.4, 2.5, 1.4],];

        // 1. Count up the material
        // The more pawns there are, the more valuable pawns and knights are,
        // and the less valuable bishops, rooks and queens are
        let n_pawn = 0;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                n_pawn += Boolean(this.board[i][j] & PAWN);
            }
        }
        const values = {
            [ANY | PAWN]: 0.9 + (n_pawn / 16 * 0.2),
            [ANY | KNIGHT]: 2.5 + (n_pawn / 16),
            [ANY | BISHOP]: 3.5 - (n_pawn / 16),
            [ANY | ROOK]: 5.1 - (n_pawn / 16 * 0.2),
            [ANY | QUEEN]: 9.1 - (n_pawn / 16 * 0.2),
            [ANY | KING]: 1,
            [ANY | EMPTY]: 1,
        };
        let material = 0;

        // damp = 0 -> only positions
        // damp = 1 -> only material

        const damp = 1 - (0.3 / (Math.floor(this.stack.length / 2) * 0.9 + 1));
        console.log("damp", damp);

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j] & EMPTY) continue;
                let value = values[this.board[i][j] | ANY] * (damp);
                const [xi, xj] = (this.board[i][j] & WHITE) ? [i, j] : [7-i, j]
                if (this.board[i][j] & PAWN) value += value * pawnMap[xi][xj] * (1 - damp);
                if (this.board[i][j] & BISHOP) value += value * bishopMap[xi][xj] * (1 - damp);
                if (this.board[i][j] & KNIGHT) value += value * knightMap[xi][xj] * (1 - damp);
                if (this.board[i][j] & ROOK) value += value * rookMap[xi][xj] * (1 - damp);
                if (this.board[i][j] & QUEEN) value += value * queenMap[xi][xj] * (1 - damp);
                if (this.board[i][j] & KING) value += value *kingMap[xi][xj] * (1 - damp);
                if ((this.board[i][j] & pre) == 0) value *= -1;
                material += value;
            }
        }
        ans += material;

        this.evalMemo.set(h, ans);

        return ans;
    }

    inCheck(pre) {
        // slow method (gone): use pieceVision of all pieces
        // fast method: check squares that could attack the king - should be at least 20x faster
        // find king
        let xi = -1, xj = -1;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((this.board[i][j] & (pre | KING)) == (pre | KING)) {
                    xi = i, xj = j;
                }
            }
        }
        if (xi == -1) return true;
        const helper = ([di, dj], ...pieces) => {
            let yi = xi + di, yj = xj + dj;
            while (0 <= yi && yi < 8 && 0 <= yj && yj < 8) {
                if ((this.board[yi][yj] & EMPTY) == 0) {
                    return pieces.some(piece => (this.board[yi][yj] & piece) && (this.board[yi][yj] & pre) == 0);
                }
                yi += di, yj += dj;
            }
            return false;
        };
        // straights
        if (helper([0, +1], ROOK, QUEEN)
            || helper([0, -1], ROOK, QUEEN)
            || helper([+1, 0], ROOK, QUEEN)
            || helper([-1, 0], ROOK, QUEEN)
            // diagonals
            || helper([+1, +1], BISHOP, QUEEN)
            || helper([+1, -1], BISHOP, QUEEN)
            || helper([-1, +1], BISHOP, QUEEN)
            || helper([-1, -1], BISHOP, QUEEN)) return true;
        // pawn
        if (pre & WHITE && xi > 0) {
            if (xj > 0 && (this.board[xi - 1][xj - 1] & (BLACK | PAWN)) == (BLACK | PAWN)) return true;
            if (xj < 7 && (this.board[xi - 1][xj + 1] & (BLACK | PAWN)) == (BLACK | PAWN)) return true;
        }
        if (pre & BLACK && xi < 7) {
            if (xj > 0 && (this.board[xi + 1][xj - 1] & (WHITE | PAWN)) == (WHITE | PAWN)) return true;
            if (xj < 7 && (this.board[xi + 1][xj + 1] & (WHITE | PAWN)) == (WHITE | PAWN)) return true;
        }
        // knight
        for (let di = -2; di <= 2; di++) {
            if (xi + di < 0 || xi + di >= 8) continue;
            if (di == 0) continue;
            let adj = 3 - Math.abs(di);
            if (xj + adj >= 0 && xj + adj < 8) {
                const piece = this.board[xi + di][xj + adj];
                if ((piece & KNIGHT) && (piece & pre) == 0) return true;
            }
            if (xj - adj >= 0 && xj - adj < 8) {
                const piece = this.board[xi + di][xj - adj];
                if ((piece & KNIGHT) && (piece & pre) == 0) return true;
            }
        }
        // king
        for (let di = -1; di <= 1; di++) {
            if (xi + di < 0 || xi + di >= 8) continue;
            for (let dj = -1; dj <= 1; dj++) {
                if (di == 0 && dj == 0) continue;
                if (xj + dj < 0 || xj + dj >= 8) continue;
                if (this.board[xi + di][xj + dj] & KING) return true;
            }
        }
        return false;
    }

    legalMoves(pre) { // WHITE or BLACK
        const h = (this.hash() << 10n) + BigInt(this.stack.length) * 8n + BigInt(pre);
        if (this.legalMemo.has(h)) return this.legalMemo.get(h);
        const moves = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j] & pre) {
                    for (const option of this.pieceVision([i, j])) {
                        const [xi, xj, xf] = option;
                        if ((xf & MOVE) && (this.board[xi][xj] & EMPTY)) {
                            this.makeMove([i, j], [xi, xj]);
                            if (!this.inCheck(pre)) moves.push([[i, j, MOVE], [xi, xj]]);
                            this.undoMove();
                        }
                        if ((xf & TAKE) && (this.board[xi][xj] & EMPTY) == 0 && (this.board[xi][xj] & pre) == 0) {
                            this.makeMove([i, j], [xi, xj]);
                            if (!this.inCheck(pre)) moves.push([[i, j, TAKE], [xi, xj]]);
                            this.undoMove();
                        }
                        if (xf & (CASTLE_KINGSIDE | CASTLE_QUEENSIDE)) {
                            const [_, __, ___, ri, rj, rxi, rxj] = option;
                            const move = [[i, j, xf], [xi, xj], [ri, rj], [rxi, rxj]];
                            // move king step-by-step, making sure it never goes into check
                            const step = Math.sign(xj-j);
                            let check = this.inCheck(pre), cnt = 0;
                            for (let kj=j+step; kj!=xj; kj+=step) {
                                cnt++;
                                this.makeMove([i, kj-step], [i, kj]);
                                if (this.inCheck(pre)) check = true;
                            }
                            while (cnt-- > 0) this.undoMove();
                            if (!check) moves.push(move);
                        }
                    }
                }
            }
        }
        // TODO: en passant
        // TODO: castling
        this.legalMemo.set(h, moves);
        return moves;
    }

    turn() {
        if (this.stack.length % 2 == 0) return WHITE;
        else return BLACK;
    }

    countVisionIncrease(move) {
        let start, end;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j] & EMPTY) continue;
                start += this.pieceVision([i, j]).length;
            }
        }
        this.makeMove(...move);
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j] & EMPTY) continue;
                end += this.pieceVision([i, j]).length;
            }
        }
        this.undoMove();
        return end - start;

    }

    value(move) {
        // ideas:
        // focus on unmoved pieces
        // focus on moves that are closer to the last one
        // checks, captured, attacks? 1
        // victim minus attacker
        // pawn to reach the centre?

        // implementation:
        // prioritise checks
        // then, look at captures
        // prioritise captures in terms of victim minus attacker
        // then, look at other moves

        const flag = this.classifyMove(move);

        if (flag & CHECK) {
            if (flag & TAKE) return 1 << 50;
            else return 1 << 30;
        } else if (flag & TAKE) {
            const values = {
                [ANY | PAWN]: 1,
                [ANY | KNIGHT]: 3,
                [ANY | BISHOP]: 3,
                [ANY | ROOK]: 5,
                [ANY | QUEEN]: 9,
                [ANY | KING]: 10,
                [ANY | EMPTY]: 0,
            };
            const attacker = this.board[move[0][0]][move[0][1]];
            const victim = this.board[move[1][0]][move[1][1]];
            return values[victim] - values[attacker];
        } else {
            // return this.countVisionIncrease(move)s;
            return 0;
        }
    }

    // we need some kind of sussy minimax search
    chooseMove() {
        const now = performance.now();
        const pre = this.turn();
        const other = pre & WHITE ? BLACK : WHITE;
        let n_eval = 0;
        const minimax = (branch, depth, alpha, beta, maximisingPlayer) => {
            const cur = maximisingPlayer ? pre : other;
            const moves = this.legalMoves(cur);
            const order = Array.from(moves, (_, i) => i);
            const values = moves.map(move => this.value(move));
            order.sort((a, b) => values[b] - values[a]);
            if (moves.length == 0) {
                if (!this.inCheck()) return [0, null];
                if (maximisingPlayer) return [-(1e9) * (depth + 1), null];
                else return [+(1e9) * (depth + 1), null];
            } else if (depth == 0) {
                n_eval += 1;
                return [this.evaluate(pre), null];
            }
            if (maximisingPlayer) {
                let mx = -Infinity, mxm = null;
                for (let i = 0; i < Math.min(branch, order.length); i++) {
                    const move = moves[order[i]];
                    this.makeMove(...move);
                    const [x, _] = minimax(branch * 2, depth - 1, alpha, beta, false);
                    if (x > mx || mx == -Infinity) {
                        mx = x;
                        mxm = move;
                    }
                    this.undoMove();
                    alpha = Math.max(alpha, x);
                    if (beta <= alpha) break;
                }
                return [mx, mxm];
            } else {
                let mn = +Infinity, mnm = null;
                for (let i = 0; i < Math.min(branch, order.length); i++) {
                    const move = moves[order[i]];
                    this.makeMove(...move);
                    const [x, _] = minimax(branch * 2, depth - 1, alpha, beta, true);
                    if (x < mn || mn == Infinity) {
                        mn = x;
                        mnm = move;
                    }
                    this.undoMove();
                    beta = Math.min(beta, x);
                    if (beta <= alpha) break;
                }
                return [mn, mnm];
            }
        };
        let mx = -Infinity, mxm = null;
        const depth = this.getDepth();
        const runs = [[BRANCH, depth]];
        for (const [BRANCH, DEPTH] of runs) {
            const [x, move] = minimax(BRANCH, DEPTH, -Infinity, Infinity, true);
            if (x > mx || mx == -Infinity) {
                mx = x;
                mxm = move;
            }
        }
        console.log((performance.now() - now).toFixed(2) + "ms");
        console.log(n_eval + " evaluated");
        console.log(mxm);
        if (mxm == null) {
            // player already lost/won
            return null;
        } else {
            return mxm;
        }
    }

    // chooseMove() {
    //     // setup
    //     const now = performance.now();
    //     let n_eval = 0;
    //     const turn = this.turn();
    //     const other = turn == WHITE ? BLACK : WHITE;

    //     // alpha-beta-gamma tree
    //     const pq = new PQueue();
    //     const alpha = [], beta = [], gamma = [];
    //     const parent = [], best = [], depth = [], rem = [];
    //     let nextId = 0;

    //     // perform all the moves to load a certain board
    //     const loadBoard = (id) => {
    //         const [next, move] = parent[id];
    //         if (next != null) loadBoard(next);
    //         if (move != null) this.makeMove(...move);
    //     };

    //     // undo all moves back to root
    //     const unloadBoard = (id) => {
    //         for (let i=0; i<depth[id]; i++) {
    //             this.undoMove();
    //         }
    //     };

    //     // add the current board to the priority-queue
    //     const addState = (par, move) => {
    //         alpha[nextId] = -Infinity;
    //         beta[nextId] = Infinity;
    //         n_eval += 1;
    //         gamma[nextId] = this.evaluate(turn);
    //         if (this.inCheck(turn)) gamma[nextId] -= 5;
    //         if (this.inCheck(other)) gamma[nextId] += 5;
    //         parent[nextId] = [par, move];
    //         best[nextId] = null;
    //         rem[nextId] = 0;
    //         if (par == null) depth[nextId] = 0;
    //         else depth[nextId] = depth[par] + 1;
    //         if (depth[nextId] % 2 == 0) gamma[nextId] = 5 - gamma[nextId];
    //         pq.addKey(nextId, gamma[nextId]);
    //         nextId += 1;
    //     };

    //     // propagate alpha/beta values down path from root
    //     const pulldown = (node) => {
    //         const par = parent[node][0];
    //         if (par == null) return;
    //         pulldown(par);
    //         alpha[node] = Math.max(alpha[node], alpha[par]);
    //         beta[node] = Math.min(beta[node], beta[par]);
    //     };

    //     // propagate alpha/beta values up path to root
    //     const pushup = (node) => {
    //         if (rem[node] > 0) return; // only pushup if alpha/beta concluded
    //         const par = parent[node][0];
    //         if (par == null) return;
    //         if (depth[par] % 2 == 0) {
    //             rem[par] -= 1;
    //             if (beta[node] > alpha[par]) {
    //                 alpha[par] = beta[node];
    //                 best[par] = node;
    //             }
    //         } else { 
    //             rem[par] -= 1;
    //             if (alpha[node] < beta[par]) {
    //                 beta[par] = alpha[node];
    //                 best[par] = node;
    //             }
    //         }
    //         pushup(par);
    //     };

    //     // add root node
    //     addState(null, null);

    //     // perform a complete search
    //     while (!pq.empty()) {
    //         // pick the node to look at
    //         const id = pq.extractKey();
    //         pulldown(id);

    //         // at any point, if alpha >= beta, then skip
    //         if (alpha[id] >= beta[id]) {
    //             rem[id] = 0;
    //             pushup(id);
    //             continue;
    //         }

    //         // get children
    //         loadBoard(id);
    //         const moves = this.legalMoves(this.turn());

    //         // if the node is at the max depth, then find the alpha/beta value manually
    //         if (depth[id] == DEPTH) {
    //             moves.sort((a, b) => this.value(b) - this.value(a));
    //             for (const move of moves) {
    //                 this.makeMove(...move);
    //                 n_eval += 1;
    //                 if (DEPTH % 2 == 0) alpha[id] = Math.max(alpha[id], this.evaluate(turn));
    //                 else beta[id] = Math.min(beta[id], this.evaluate(turn));
    //                 this.undoMove();
    //                 // at any point, if alpha >= beta, then skip
    //                 if (alpha[id] >= beta[id]) break;
    //             }
    //             pushup(id);
    //         } 

    //         // otherwise, add its children to the priority queue
    //         else {
    //             for (const move of moves) {
    //                 this.makeMove(...move);
    //                 rem[id] += 1;
    //                 addState(id, move);
    //                 this.undoMove();
    //             }
    //         }

    //         // unload board
    //         unloadBoard(id);
    //     }

    //     // output metrics
    //     console.log("TIME: " + (performance.now() - now).toFixed(2) + "ms");
    //     console.log("EVALUATIONS: " + n_eval);
    //     console.log("ALPHA: " + alpha[0]);

    //     // return best move, hopefully it works great! :)
    //     return parent[best[0]][1];
    // }

    static coordIJ(coord) {
        return [8 - coord[1], coord[0].charCodeAt() - 97];
    }

    static ijCoord([i, j]) {
        return String.fromCharCode(97 + j) + String(8 - i);
    }

    static flipIJ([i, j]) {
        return [7 - i, 7 - j];
    }

    getPoints(pre) {
        let points = 0;

        const values = {
            [ANY | PAWN]: 1,
            [ANY | KNIGHT]: 3,
            [ANY | BISHOP]: 3,
            [ANY | ROOK]: 5,
            [ANY | QUEEN]: 9,
            [ANY | KING]: 0,
        };

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j] & EMPTY) continue;
                if ((this.board[i][j] & pre) == 0) continue;
                let value = values[ANY | this.board[i][j]];
                points += value;
            }
        }

        return points;
    }

    endGame() {
        return this.stack.length;
    }

    copyPGN() {
        return this.stack;
    }

    getDepth() {
        const mn = Math.min(10, Math.sqrt(this.getPoints(WHITE) * this.getPoints(BLACK)));
        const b_estimate = Math.sqrt(Math.max(mn, this.legalMoves(WHITE).length) * Math.max(mn, this.legalMoves(BLACK).length));
        const depth = Math.max(3, Math.round(10 - 7 / 20 * b_estimate));
        return depth;
    }
}

const __chess = new Chess(initialBoard);

onmessage = (ev) => {
    const [f, ...args] = ev.data;
    postMessage([f, __chess[f](...args)]);
};

