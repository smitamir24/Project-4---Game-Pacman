// ---------- DOM ----------
const playButton = document.getElementById("playButton");
const settingButton = document.getElementById("settingButton");
const exitButton = document.getElementById("exitButton");
const backToMenu = document.getElementById("backToMenu");
const backWithGameToMenu = document.getElementById("backWithGameToMenu");

const mainMenu = document.getElementById("mainMenu");
const mainSetting = document.getElementById("mainSetting");
const mainGame = document.getElementById("mainGame");
const menuWin = document.getElementById("menuWin");
const bg = document.querySelector(".bg");
const balanceDisplay = document.querySelector(".balanceDisplay");

const addSizeButton = document.getElementById("add10sizemap");
const delSizeButton = document.getElementById("del10sizemap");
const mapSizeText = document.getElementById("mapsizetext");

// ---------- Настройки ----------
const DEBUG = true; // поставь false перед релизом

const ROWS = 18;
const COLS = 25;
const TOTAL_COINS = 219;
const MOVE_COOLDOWN_MS = 100;
const WIN_MENU_DELAY_MS = 4000;

const MAP_SIZE_MIN = 30;
const MAP_SIZE_MAX = 150;
const MAP_SIZE_STEP = 10;

// Строки (индексы с 0), на которых края карты соединены телепортом
const TUNNEL_ROWS = [8, 9];

// Стены: номер строки (с 1) -> колонки (с 1). Число = одна клетка, [от, до] = диапазон.
// Строки 1 и 18 заполнены стеной целиком (см. isWall).
const EDGES = [1, COLS];
const WALLS = {
    2:  [...EDGES, [18, 19], 21],
    3:  [...EDGES, [3, 8], 10, [12, 14], 16, 23],
    4:  [...EDGES, [3, 7], 10, [16, 17], [19, 21], 23],
    5:  [...EDGES, [9, 10], [12, 14], 23],
    6:  [...EDGES, [3, 4], [6, 7], [9, 10], 13, 17, [19, 21], 23],
    7:  [...EDGES, [6, 7], 9, 17, [19, 20]],
    8:  [...EDGES, [2, 4], 6, [11, 12], [14, 15], 17, [19, 20], [22, 24]],
    9:  [6, [8, 9], 11, 15, [19, 20]],            // без краёв: тоннель
    10: [6, 9, [11, 15], 17, [19, 20]],           // без краёв: тоннель
    11: [...EDGES, [2, 4], [6, 7], [19, 20], [22, 24]],
    12: [...EDGES, [6, 7], [9, 17], [19, 20]],
    13: [...EDGES, [3, 4], [6, 7], 9, 17, [19, 23]],
    14: [...EDGES, [3, 4], 9, [11, 12], [14, 15], 17, 23],
    15: [...EDGES, [6, 7], 9, 12, 14, 17, [19, 21], 23],
    16: [...EDGES, [3, 4], [6, 7], [9, 12], [14, 17], [19, 23]],
    17: [...EDGES],
};

// ---------- Состояние ----------
let mapSize = 100;
let balance = 0;
let isPlaying = false;
let onCooldown = false;

let playerRow = 10;
let playerCol = 12;

const gameMap = [];

const player = document.createElement("img");
player.src = "./Texture/Player.png";
player.classList.add("PlayerIcon");

// ---------- Вспомогательное ----------
// Показывает элемент с плавным появлением (display -> reflow -> opacity)
function fadeIn(element) {
    element.style.display = "flex";
    void element.offsetHeight;
    element.style.opacity = "1";
}

// ---------- Размер карты ----------
function changeMapSize(delta) {
    mapSize = Math.min(MAP_SIZE_MAX, Math.max(MAP_SIZE_MIN, mapSize + delta));
    mapSizeText.textContent = `${mapSize}%`;
    mainGame.style.width = `${mapSize}%`;
}

addSizeButton.addEventListener("click", () => changeMapSize(MAP_SIZE_STEP));
delSizeButton.addEventListener("click", () => changeMapSize(-MAP_SIZE_STEP));
changeMapSize(0); // синхронизируем текст с начальным значением

// ---------- Карта ----------
function isWall(row, col) {
    if (row === 1 || row === ROWS) return true;

    return (WALLS[row] ?? []).some((item) =>
        Array.isArray(item) ? col >= item[0] && col <= item[1] : col === item
    );
}

function createCoin() {
    const coin = document.createElement("div");
    coin.classList.add("coin");
    return coin;
}

function buildMap() {
    for (let row = 1; row <= ROWS; row++) {
        const rowElement = document.createElement("div");
        rowElement.classList.add("positionHorizontal");

        const cells = [];

        for (let col = 1; col <= COLS; col++) {
            const cell = document.createElement("div");
            cell.classList.add("positionCell", "centered");

            const isStartCell = row - 1 === playerRow && col - 1 === playerCol;

            if (isWall(row, col)) {
                cell.classList.add("block");
            } else if (!isStartCell) {
                cell.append(createCoin());
            }

            rowElement.append(cell);
            cells.push(cell);
        }

        mainGame.append(rowElement);
        gameMap.push(cells);
    }
}

buildMap();

// ---------- Монеты и победа ----------
function showWin() {
    bg.style.display = "flex";
    void bg.offsetHeight;
    bg.style.opacity = "1";
    balanceDisplay.classList.add("win");

    setTimeout(() => {
        balanceDisplay.classList.remove("visible");
        balanceDisplay.classList.add("fadeOut");
        fadeIn(menuWin);
    }, WIN_MENU_DELAY_MS);
}

function collectCoin(cell) {
    const coin = cell.querySelector(".coin");
    if (!coin) return;

    coin.remove();
    balance++;
    balanceDisplay.textContent = `Очки: ${balance}/${TOTAL_COINS}`;

    if (balance === TOTAL_COINS) showWin();
}

// ---------- Движение ----------
function placePlayer(row, col) {
    playerRow = row;
    playerCol = col;

    const cell = gameMap[row][col];
    collectCoin(cell);
    cell.append(player);
}

function movePlayer(dRow, dCol) {
    const newRow = playerRow + dRow;
    let newCol = playerCol + dCol;

    // Телепорт через края карты
    if (TUNNEL_ROWS.includes(newRow)) {
        if (newCol < 0) newCol = COLS - 1;
        else if (newCol >= COLS) newCol = 0;
    }

    const inBounds = newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS;
    if (!inBounds) return;

    if (gameMap[newRow][newCol].classList.contains("block")) return;

    placePlayer(newRow, newCol);
}

// ---------- Меню ----------
playButton.addEventListener("click", () => {
    balanceDisplay.classList.add("visible");
    mainMenu.style.backdropFilter = "blur(0px)";
    playButton.style.display = "none";
    settingButton.style.display = "none";
    exitButton.style.display = "none";

    gameMap[playerRow][playerCol].append(player);

    // Ждём окончания анимации размытия меню (transition 0.5s)
    setTimeout(() => {
        mainMenu.style.display = "none";
        mainSetting.style.display = "none";
        mainGame.style.display = "flex";
        isPlaying = true;
    }, 500);
});

settingButton.addEventListener("click", () => {
    mainMenu.style.display = "none";
    mainSetting.style.display = "flex";
});

exitButton.addEventListener("click", () => {
    if (confirm("Закрыть игру?")) window.close();
});

backToMenu.addEventListener("click", () => {
    mainMenu.style.display = "flex";
    mainSetting.style.display = "none";
});

backWithGameToMenu.addEventListener("click", () => {
    location.reload();
});

// ---------- Управление ----------
const MOVE_KEYS = {
    KeyW: [-1, 0],
    KeyA: [0, -1],
    KeyS: [1, 0],
    KeyD: [0, 1],
};

window.addEventListener("keydown", (event) => {
    if (!isPlaying) return;

    if (DEBUG && event.code === "KeyC") {
        collectAllCoins();
        return;
    }

    const direction = MOVE_KEYS[event.code];
    if (!direction || onCooldown) return;

    movePlayer(...direction);

    onCooldown = true;
    setTimeout(() => {
        onCooldown = false;
    }, MOVE_COOLDOWN_MS);
});