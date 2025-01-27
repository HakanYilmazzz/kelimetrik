class WordGame {
    constructor() {
        this.grid = [];
        this.selectedCells = [];
        this.currentWord = '';
        this.score = 0;
        this.gameTime = 180; // 3 dakika
        this.timeLeft = this.gameTime;
        this.timer = null;
        this.foundWords = new Map(); // Her uzunluk için ayrı bir Set
        this.checkingWord = false;
        this.combo = 0;
        this.lastWordTime = Date.now();
        this.highScore = localStorage.getItem('highScore') || 0;
        
        // Zor harfler için bonus puanlar
        this.bonusLetters = {
            'Ğ': 5, 'Ş': 4, 'Ç': 4, 'Ö': 3, 'Ü': 3, 
            'İ': 2, 'I': 2, 'Z': 2, 'J': 5, 'F': 2
        };
        
        this.gridElement = document.getElementById('grid');
        this.currentWordElement = document.getElementById('current-word');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.resetButton = document.getElementById('reset-btn');
        this.foundWordsElement = document.getElementById('found-words');
        
        this.initializeGame();
        this.setupEventListeners();
        this.updateHighScore();
    }

    initializeGame() {
        // Türkçe harflerin dağılımı (sık kullanılan harfler daha fazla)
        const letters = 'AAAAAABCÇDEEEEEFGĞHIİİİJKLLLMNOÖPRSŞTUÜVYZZ';
        this.grid = [];
        this.foundWords = new Map();
        this.foundWordsElement.innerHTML = '';
        this.score = 0;
        this.scoreElement.textContent = '0';
        
        // Grid'i oluştur
        for(let i = 0; i < 10; i++) {
            this.grid[i] = [];
            for(let j = 0; j < 10; j++) {
                this.grid[i][j] = letters[Math.floor(Math.random() * letters.length)];
            }
        }
        
        // Kelime gruplarını oluştur
        for(let i = 2; i <= 10; i++) {
            const group = document.createElement('div');
            group.className = 'word-group';
            
            const title = document.createElement('div');
            title.className = 'word-group-title';
            title.innerHTML = `${i} Harfli Kelimeler`;
            
            const list = document.createElement('ul');
            list.className = 'found-words';
            
            group.appendChild(title);
            group.appendChild(list);
            this.foundWordsElement.appendChild(group);
            
            this.foundWords.set(i, new Set());
        }
        
        this.renderGrid();
        this.startTimer();
        
        // Seçili hücreleri temizle
        this.selectedCells = [];
        this.currentWord = '';
        this.updateCurrentWord();
    }

    calculateWordScore(word) {
        let score = 0;
        
        // Temel puan (kelime uzunluğu)
        score += word.length * 10;
        
        // Zor harfler için bonus
        for(let letter of word) {
            if(this.bonusLetters[letter]) {
                score += this.bonusLetters[letter];
            }
        }
        
        // Combo bonus (son 3 saniye içinde kelime bulunduysa)
        const timeDiff = Date.now() - this.lastWordTime;
        if(timeDiff < 3000) {
            this.combo++;
            score *= (1 + (this.combo * 0.1)); // Her combo %10 bonus
        } else {
            this.combo = 0;
        }
        
        // Uzun kelime bonusu
        if(word.length >= 6) {
            score *= 1.5; // 6 ve üzeri harfli kelimeler için %50 bonus
        }
        
        return Math.round(score);
    }

    updateHighScore() {
        this.scoreElement.textContent = `Skor: ${this.score}`;
    }

    showNewHighScoreEffect() {
        const effect = document.createElement('div');
        effect.className = 'high-score-effect';
        effect.textContent = 'Yeni Rekor! 🏆';
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 2000);
    }

    async isValidWord(word) {
        if (word.length < 2 || word.length > 10) return false;
        if (this.foundWords.get(word.length).has(word)) return false;
        
        try {
            word = word.toLocaleLowerCase('tr-TR');
            const response = await fetch(`https://kelimelikbackend-production.up.railway.app/api/kelime/${word}`);
            
            if (!response.ok) return false;
            
            const data = await response.json();
            
            // Kelime geçerliyse anlamını da saklayalım
            if (Array.isArray(data) && data.length > 0) {
                // Kelime anlamını cache'leyelim
                this.wordMeanings = this.wordMeanings || new Map();
                if (data[0].anlamlarListe && data[0].anlamlarListe.length > 0) {
                    this.wordMeanings.set(word, data[0].anlamlarListe[0].anlam);
                } else {
                    this.wordMeanings.set(word, 'Anlam bulunamadı');
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Kelime kontrolü sırasında hata:', error);
            return false;
        }
    }

    getWordMeaning(word) {
        word = word.toLocaleLowerCase('tr-TR');
        return this.wordMeanings.get(word) || 'Anlam bulunamadı';
    }

    renderGrid() {
        this.gridElement.innerHTML = '';
        for(let i = 0; i < 10; i++) {
            for(let j = 0; j < 10; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.textContent = this.grid[i][j];
                this.gridElement.appendChild(cell);
            }
        }
    }

    setupEventListeners() {
        this.gridElement.addEventListener('mousedown', (e) => this.handleCellClick(e));
        this.gridElement.addEventListener('mouseover', (e) => this.handleCellDrag(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        this.resetButton.addEventListener('click', () => this.initializeGame());
    }

    handleCellClick(e) {
        const cell = e.target;
        if(!cell.classList.contains('cell')) return;
        
        this.isDragging = true;
        this.selectCell(cell);
    }

    handleCellDrag(e) {
        if(!this.isDragging) return;
        const cell = e.target;
        if(!cell.classList.contains('cell')) return;
        
        this.selectCell(cell);
    }

    handleMouseUp() {
        this.isDragging = false;
        if(this.currentWord.length >= 2 && !this.checkingWord) {
            this.checkWord();
        }
        
        // Seçili hücreleri temizle
        this.selectedCells.forEach(cell => {
            cell.classList.remove('selected');
        });
        this.selectedCells = [];
        this.currentWord = '';
        this.updateCurrentWord();
        
        // Tüm çizgileri temizle
        document.querySelectorAll('.path-line').forEach(line => line.remove());
    }

    async checkWord() {
        this.checkingWord = true;
        const word = this.currentWord;
        
        if (await this.isValidWord(word)) {
            const wordScore = this.calculateWordScore(word);
            this.score += wordScore;
            this.foundWords.get(word.length).add(word);
            await this.addWordToList(word, wordScore);
            this.updateHighScore();
            this.lastWordTime = Date.now();
            
            // Skor animasyonu
            this.showScoreAnimation(wordScore);
        } else {
            this.combo = 0; // Geçersiz kelimede combo sıfırlanır
            this.currentWordElement.classList.add('invalid');
            setTimeout(() => {
                this.currentWordElement.classList.remove('invalid');
            }, 500);
        }
        
        this.checkingWord = false;
    }

    async addWordToList(word, score) {
        const length = word.length;
        const wordSet = this.foundWords.get(length);
        wordSet.add(word);
        
        const group = this.foundWordsElement.children[length - 2];
        const listElement = group.querySelector('.found-words');
        const meaning = this.getWordMeaning(word);
        
        const li = document.createElement('li');
        li.textContent = word;
        li.dataset.length = length;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'word-score';
        scoreSpan.textContent = `+${score}`;
        li.appendChild(scoreSpan);
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = meaning;
        li.appendChild(tooltip);
        
        li.style.opacity = '0';
        listElement.insertBefore(li, listElement.firstChild);
        
        setTimeout(() => {
            li.style.opacity = '1';
        }, 50);

        this.createConfetti();
    }

    createConfetti() {
        const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];
        for(let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            document.body.appendChild(confetti);
            
            // Animasyon bitince elementi kaldır
            setTimeout(() => confetti.remove(), 3000);
        }
    }

    selectCell(cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Eğer hücre zaten seçiliyse, işlem yapma
        if(this.selectedCells.includes(cell)) return;
        
        // İlk seçim değilse, önceki seçimle bağlantılı olmalı
        if(this.selectedCells.length > 0) {
            const lastCell = this.selectedCells[this.selectedCells.length - 1];
            const lastRow = parseInt(lastCell.dataset.row);
            const lastCol = parseInt(lastCell.dataset.col);
            
            // Çapraz, yatay veya dikey olarak bitişik olmalı
            const rowDiff = Math.abs(row - lastRow);
            const colDiff = Math.abs(col - lastCol);
            if(rowDiff > 1 || colDiff > 1) return;

            // Harfleri birleştiren çizgi
            this.drawPathLine(lastCell, cell);
        }
        
        cell.classList.add('selected');
        this.selectedCells.push(cell);
        this.currentWord += this.grid[row][col];
        this.updateCurrentWord();
    }

    drawPathLine(cell1, cell2) {
        const rect1 = cell1.getBoundingClientRect();
        const rect2 = cell2.getBoundingClientRect();
        
        const x1 = rect1.left + rect1.width / 2;
        const y1 = rect1.top + rect1.height / 2;
        const x2 = rect2.left + rect2.width / 2;
        const y2 = rect2.top + rect2.height / 2;
        
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        const line = document.createElement('div');
        line.className = 'path-line';
        line.style.width = length + 'px';
        line.style.height = '2px';
        line.style.position = 'fixed';
        line.style.left = x1 + 'px';
        line.style.top = y1 + 'px';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 0';
        
        document.body.appendChild(line);
        setTimeout(() => line.remove(), 300); // Çizgiyi kısa süre sonra kaldır
    }

    updateCurrentWord() {
        this.currentWordElement.textContent = this.currentWord;
    }

    startTimer() {
        if(this.timer) clearInterval(this.timer);
        this.timeLeft = this.gameTime;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if(this.timeLeft <= 0) {
                clearInterval(this.timer);
                // Oyun bitiminde yüksek skor kontrolü
                if(this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('highScore', this.score);
                    alert(`Yeni Rekor! 🏆\nPuanınız: ${this.score}`);
                    this.showNewHighScoreEffect();
                } else {
                    alert(`Oyun bitti! Puanınız: ${this.score}\nRekor: ${this.highScore}`);
                }
                this.initializeGame();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    showScoreAnimation(score) {
        const animation = document.createElement('div');
        animation.className = 'score-animation';
        animation.textContent = `+${score}`;
        if(this.combo > 0) {
            animation.textContent += ` (${this.combo}x Combo!)`;
        }
        this.scoreElement.appendChild(animation);
        
        setTimeout(() => animation.remove(), 1000);
    }
}

// Oyunu başlat
window.addEventListener('DOMContentLoaded', () => {
    new WordGame();
}); 