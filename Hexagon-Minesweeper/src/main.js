const COLORS = {
    WHITE: 'white',
    BLACK: 'black',
    TAN: 'tan',
    BROWN: '#905c3c',
    GRAY: '#c0bcbc',
    RED: 'red',
};

function main() {
    const canvas = document.getElementById('Board');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;

    var board = new Board(5, 16, 30);

    document.getElementById('Start').addEventListener('click', () => {
        board = new Board(5, 16, 30);
        board.initGame();
        console.log('Start button clicked');
    });

    document.getElementById('Reset').addEventListener('click', () => {
        board = new Board(5, 16, 30);
        board.initGame();
        console.log('Reset button clicked');
    });
    canvas.addEventListener('contextmenu', function(event) {
        event.preventDefault(); // Prevent the default context menu from appearing

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        console.log(`Right-click at (${x}, ${y})`);
        board.checkClick(x, y, true);

    });
    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        console.log(`Click at (${x}, ${y})`);
        board.checkClick(x, y, false);
        
    });
}

class Board {
    constructor(cols, rows, length) {
        this.cols = cols;
        this.rows = rows;
        this.length = length;
        this.tiles = [];
        this.bombs = [];
        this.flags = [];
        this.gameOver = false;
        this.firstClick = false;
    }

    initGame() {
        const canvas = document.getElementById("Board");
        const ctx = canvas.getContext("2d");
    
        const hexHeight = Math.sqrt(3) * this.length;
        const hexWidth = 2 * this.length;
        const vertDist = hexHeight / 2; // Vertical distance between hexagon centers including gap
        const horizDist = 3 * this.length; // Horizontal distance between hexagon centers including gap
    
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const xOffset = (row % 2 == 0) ?  0 : this.length * 1.5;     // Offset for staggered rows
                const x = col * horizDist + xOffset + 50;
                const y = row * vertDist + 50;
                const tile = new Tile(this.length, x, y);
                this.tiles.push(tile);
                tile.draw(ctx);
            }
        }
        // Count the number of bombs in the neighboring tiles
        for (let tile of this.tiles) {
            tile.bombCount(this.tiles);
        }
        ctx.stroke();
    }

    drawGameOver(ctx) {
        // Game over background. fill a box around the text white.
        ctx.fillStyle = COLORS.WHITE;
        ctx.fillRect(150, 200, 200, 100);
        

        // Game Over Text
        ctx.font = "30px Arial";
        ctx.fillStyle = COLORS.RED;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Game Over!", 250, 250);
    }

    checkClick(x, y, isRightClick) {
        if (this.gameOver) {
            return;
        }
        const ctx = document.getElementById('Board').getContext('2d');
        
        if (!this.firstClick) {
            this.firstClick = true;
            
            let firstTile = null;
            for (let tile of this.tiles) {
                if (tile.isInsideHexagon(x, y)) {
                    firstTile = tile;  // Identify the clicked tile
                    break;
                }
            }
    
            if (firstTile) {

                const safeTiles = new Set([firstTile, ...firstTile.getNeighbors(this.tiles)]);
                
                // Expand the safe area to include second-degree neighbors
                for (let tile of Array.from(safeTiles)) {
                    const secondDegreeNeighbors = tile.getNeighbors(this.tiles);
                    secondDegreeNeighbors.forEach(neighbor => safeTiles.add(neighbor));
                }
    
                // Ensure the first tile and all its neighbors are safe
                for (let tile of safeTiles) {
                    tile.tileDetails.isBomb = false;
                }
    
                // Now, place bombs on the rest of the grid (excluding safe tiles)
                for (let tile of this.tiles) {
                    if (!safeTiles.has(tile)) {
                        tile.tileDetails.isBomb = Math.random() < 0.3; // Random bomb placement
                    }
                }
                // Assign the tile list to each tile
                for (let tile of this.tiles) {
                    tile.tile_list = this.tiles;
                }

                // *** Important: Calculate bomb counts for all tiles ***
                for (let tile of this.tiles) {
                    tile.bombCount(this.tiles);  // Ensure bomb counts are updated before revealing
                }
    
                // Draw all tiles after bomb count calculation
                for (let tile of this.tiles) {
                    tile.draw(ctx);  // Now draw the updated tiles with correct bomb counts
                }
    
                // Apply AC-3 to ensure solvability
                let ac3Solver = new AC3(this.tiles);
                ac3Solver.solve();

                // If the bomb placement is not solvable, reset the game
                
                
            }
        }
    
        // Handle normal left or right-click behavior
        for (let tile of this.tiles) {
            if (tile.isInsideHexagon(x, y)) {
                console.log('Tile at ' + x + ', ' + y + ' clicked');
                tile.tileDetails.isRevealed = !isRightClick && !tile.tileDetails.isFlagged;
                tile.tileDetails.isFlagged = isRightClick;
                tile.draw(ctx);
                
                // If the tile is a bomb, game over
                if (tile.tileDetails.isBomb && tile.tileDetails.isRevealed) {
                    this.gameOver = true;
                    console.log('Game over!');
                    this.drawGameOver(ctx);
                } 

                // Reveal neighboring tiles if the clicked tile has 0 bombs nearby
                if (tile.tileDetails.numBombs === 0 && tile.tileDetails.isRevealed && !tile.tileDetails.isBomb) {
                    tile.revealNeighbors(this.tiles, ctx);
                }
    
                // Re-apply AC-3 to propagate new information
                let ac3Solver = new AC3(this.tiles);
                ac3Solver.solve();
    
                return;
            }
        }
    }
}
class Tile {
    constructor(length, x, y) {
        this.length = length;
        this.x = x;
        this.y = y;
        this.tileDetails = {
            isBomb: false,
            isFlagged: false,
            isRevealed: false,
            numBombs: 0,
        };
        this.neighbors = [];
        this.tile_list = [];
    }
    addNeighbor(tile) {
        this.neighbors.push(tile);
    }

    draw(ctx) {
        const startX = this.x;
        const startY = this.y;
    
        ctx.beginPath();
        ctx.moveTo(
            this.x + this.length * Math.cos(0),
            this.y + this.length * Math.sin(0)
        );
    
        for (let i = 1; i <= 6; i++) {
            ctx.lineTo(
                this.x + this.length * Math.cos((i * Math.PI) / 3), 
                this.y + this.length * Math.sin((i * Math.PI) / 3)
            );
        }
    
        ctx.closePath();
    
        // Fill or stroke based on whether the tile is revealed
        if (this.tileDetails.isRevealed) {
            ctx.strokeStyle = COLORS.BLACK;
            ctx.stroke();
            ctx.fillStyle = COLORS.GRAY;
            ctx.fill();
        } else {
            const gradient = ctx.createLinearGradient(this.x, this.y - this.length, this.x, this.y + this.length);
            gradient.addColorStop(0.2, 'white'); // Highlight at the top
            gradient.addColorStop(1, COLORS.GRAY); // Shading at the bottom
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        ctx.lineWidth = 3;
        ctx.stroke();
    
        // Display flag or bomb based on tile state
        if (this.tileDetails.isFlagged) {
            this.drawFlag(ctx);
        } else if (this.tileDetails.isRevealed) {
            if (this.tileDetails.isBomb) {
                this.drawBomb(ctx);
            } else {
                this.drawNumber(ctx);  // Draw the number of bombs if any
            }
        }
    }
    drawBomb(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS.BLACK;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    drawNumber(ctx) {
        if (this.tileDetails.numBombs > 0) {  // Only draw the number if bombs are nearby
            ctx.font = "20px Arial";
            ctx.fillStyle = COLORS.BLACK;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.tileDetails.numBombs, this.x, this.y);  // Display number of bombs
        }
    }
    drawFlag(ctx) {
        // Draw the flag
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 10);
        ctx.lineTo(this.x, this.y + 10);
        ctx.lineTo(this.x + 10, this.y + 5);
        ctx.lineTo(this.x, this.y - 10);


        ctx.fillStyle = COLORS.RED;
        ctx.fill();
        // Draw the flagpole
        ctx.moveTo(this.x, this.y + 10);
        ctx.lineTo(this.x, this.y + 20);
        
        ctx.lineWidth = 1;
        ctx.stroke();

    }
    // Function to count the number of bombs in the neighboring tiles
    bombCount() {
        // If the tile is a bomb, return without counting
        if (this.tileDetails.isBomb) {
            this.tileDetails.numBombs = -1;  // Special marker for bomb tiles
            return;
        }
    
        // Count bombs in neighboring tiles
        const neighbors = this.getNeighbors();
        let count = 0;
        for (let neighbor of neighbors) {
            if (neighbor.tileDetails.isBomb) {
                count++;
            }
        }
    
        this.tileDetails.numBombs = count;
    }
    // Function to get the neighboring tiles
    getNeighbors(tile_list) {
        if (tile_list === undefined) {
            tile_list = this.tile_list;
        }
        const neighbors = [];
        for (let tile of tile_list) {
            if (tile === this) {
                continue;
            }
            const dx = tile.x - this.x;
            const dy = tile.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 2 * this.length) {  // Adjust this threshold if necessary
                neighbors.push(tile);
            }
        }
        return neighbors;
    }
    
    // Recursively reveal zero-bomb areas
    revealZeros(tile) {
        if (tile.tileDetails.numBombs !== 0) return;
        let neighbors = getNeighbors(tile);
        neighbors.forEach(neighbor => {
            if (!neighbor.revealed) {
                neighbor.reveal();
                revealZeros(neighbor);
            }
        });
    }

    // Reveal the tile and its neighbors
    revealNeighbors(tile_list, ctx) {
        this.tileDetails.isRevealed = true;
        this.draw(ctx);
        if (this.tileDetails.numBombs === 0) {
            let neighbors = this.getNeighbors(tile_list);
            for (let neighbor of neighbors) {
                if (!neighbor.tileDetails.isRevealed && !neighbor.tileDetails.isFlagged) {
                    neighbor.revealNeighbors(tile_list, ctx);
                }
            }
        }
    }
    isInsideHexagon(x, y) {

        // Calculate the vertices of the hexagon
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;  // 60 degrees in radians
            const xVerticie = this.x + this.length * Math.cos(angle);
            const yVerticie = this.y + this.length * Math.sin(angle);
            vertices.push([xVerticie, yVerticie]);
        }

        // Function to compute 2D cross product of two vectors (x1, y1) and (x2, y2)
        function crossProduct(x1, y1, x2, y2) {
            return x1 * y2 - y1 * x2;
        }

        let sign = null;
        
        for (let i = 0; i < 6; i++) {
            const x1 = vertices[i][0];
            const y1 = vertices[i][1];
            const x2 = vertices[(i + 1) % 6][0];
            const y2 = vertices[(i + 1) % 6][1];

            // Edge vector and point-to-vertex vector
            const edgeVector = [x2 - x1, y2 - y1];
            const pointVector = [x - x1, y - y1];

            // Calculate the cross product
            const crossProd = crossProduct(edgeVector[0], edgeVector[1], pointVector[0], pointVector[1]);

            if (crossProd !== 0) {
            const currentSign = crossProd > 0;
            if (sign === null) {
                sign = currentSign;
            } else if (sign !== currentSign) {
                return false;  // Point is outside if signs differ
            }
            }
        }
        return true;  // Point is inside if all cross products have the same sign
    }
}
class Arc {
    constructor(tile1, tile2, constraint) {
        this.tile1 = tile1;
        this.tile2 = tile2;
        this.constraint = constraint;
    }
}

class AC3 {
    constructor(tiles) {
        this.tiles = tiles;
        this.queue = [];
        // Initialize the queue with all arcs and constraints
        for (let tile of tiles) {
            let neighbors = tile.getNeighbors(tiles);
            for (let neighbor of neighbors) {
                // Define the constraint function
                let constraint = (tile1, tile2) => {
                    let neighbors = tile1.getNeighbors(this.tiles);
                    let bombCount = neighbors.filter(t => t.tileDetails.isBomb).length;
                    let safeTileCount = neighbors.filter(t => !t.tileDetails.isBomb).length;

                    // Ensure the bomb count matches and there is at least one safe neighboring tile
                    return bombCount === tile1.tileDetails.numBombs && neighbors.length != bombCount;
                };
                this.queue.push(new Arc(tile, neighbor, constraint));
            }
        }
        console.log(`Initial queue size: ${this.queue.length}`);
    }

    solve() {
        let revisionCount = 0;
        while (this.queue.length > 0) {
            let arc = this.queue.shift();
            if (this.revise(arc)) {
                revisionCount++;
                // Recalculate bomb counts for all tiles
                for (let tile of this.tiles) {
                    tile.bombCount(this.tiles);
                }
                if (arc.tile1.tileDetails.numBombs === 0) { 
                    // Reveal neighbors if no bombs around
                    arc.tile1.revealNeighbors(this.tiles, document.getElementById('Board').getContext('2d'));
                }
    
                // Re-add neighbors if arc consistency was violated
                let neighbors = arc.tile1.getNeighbors(this.tiles);
                for (let neighbor of neighbors) {
                    if (neighbor !== arc.tile2) {
                        this.queue.push(new Arc(neighbor, arc.tile1, arc.constraint));
                    }
                }
            }
        }
        console.log(`Total revisions: ${revisionCount}`);
    }

    revise(arc) {
        const { tile1, tile2, constraint } = arc;
        console.log(`Revising tile at (${tile1.x}, ${tile1.y}) with neighbor at (${tile2.x}, ${tile2.y})`);
        let revised = false;
        if (tile1.tileDetails.isRevealed && !tile1.tileDetails.isBomb) {
            let neighbors = tile1.getNeighbors(this.tiles);
            let bombCount = neighbors.filter(t => t.tileDetails.isBomb).length;
            console.log(`Tile at (${tile1.x}, ${tile1.y}) has ${bombCount} bombs around, expected ${tile1.tileDetails.numBombs}`);
            
            // Check the constraint
            if (!constraint(tile1, tile2)) {
                revised = true;
                // Adjust the number of bombs based on neighbors
                tile1.tileDetails.numBombs = bombCount;
                console.log(`Revised tile at (${tile1.x}, ${tile1.y}) to have ${tile1.tileDetails.numBombs} bombs around`);

                // Change some of the surrounding tiles to be safe if necessary
                let safeTiles = neighbors.filter(t => !t.tileDetails.isBomb);
                if (safeTiles.length > tile1.tileDetails.numBombs) {
                    let bombsToChange = safeTiles.slice(0, safeTiles.length - tile1.tileDetails.numBombs);
                    for (let bombTile of bombsToChange) {
                        bombTile.tileDetails.isBomb = true;
                        bombTile.draw(document.getElementById('Board').getContext('2d'));
                    }
                }

            }
        }
        return revised;
    }
}

main();