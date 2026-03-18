/**
 * 我的仪表盘
 * 小胖出品，必属精品
 * 版本：v1.0.4
 */

// ==================== 应用主对象 ====================
const App = {
    currentTab: 'todo',
    todos: [],
    notes: [],
    pomodoro: {
        timeLeft: 25 * 60,
        workDuration: 25,  // 专注时长（分钟）
        shortBreak: 5,     // 短休息（分钟）
        longBreak: 15,     // 长休息（分钟）
        isRunning: false,
        isBreak: false,
        isPaused: false,
        completed: 0,
        totalFocusTime: 0, // 今日专注总时长（秒）
        timer: null,
        currentTask: '',   // 当前任务标签
        sessionCount: 0,   // 当前轮次计数
        audioContext: null // 音频上下文
    },
    countdown: {
        timeLeft: 0,
        isRunning: false,
        timer: null
    },
    calculator: {
        expression: '',
        result: '0'
    },
    currentCity: {
        code: '101210101',
        name: '杭州'
    },

    // 城市代码映射
    cityMap: {
        '101210101': '杭州',
        '101040400': '宁波',
        '101030100': '天津',
        '101180101': '郑州',
        '101020100': '上海',
        '101010100': '北京'
    },

    // 初始化
    init() {
        this.loadData();
        this.initDate();
        this.fetchWeather();
        this.renderTodos();
        this.updateStats();
        this.bindEvents();
        this.initTools();
    },

    // 从localStorage加载数据
    loadData() {
        const saved = localStorage.getItem('dashboard_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.todos = data.todos || [];
            this.notes = data.notes || [];
            this.pomodoro.completed = data.pomodoroCompleted || 0;
            this.pomodoro.totalFocusTime = data.totalFocusTime || 0;
            this.pomodoro.sessionCount = data.sessionCount || 0;
            this.pomodoro.workDuration = data.workDuration || 25;
            this.pomodoro.shortBreak = data.shortBreak || 5;
            this.pomodoro.longBreak = data.longBreak || 15;
            
            // 检查是否是新的一天，重置每日统计
            const lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            const today = new Date();
            if (lastUpdate && lastUpdate.toDateString() !== today.toDateString()) {
                // 新的一天，重置每日统计
                this.pomodoro.totalFocusTime = 0;
                this.pomodoro.sessionCount = 0;
            }
        }
    },

    // 保存数据到localStorage
    saveData() {
        const data = {
            todos: this.todos,
            notes: this.notes,
            pomodoroCompleted: this.pomodoro.completed,
            totalFocusTime: this.pomodoro.totalFocusTime,
            sessionCount: this.pomodoro.sessionCount,
            workDuration: this.pomodoro.workDuration,
            shortBreak: this.pomodoro.shortBreak,
            longBreak: this.pomodoro.longBreak,
            lastUpdate: new Date().toISOString()
        };
        localStorage.setItem('dashboard_data', JSON.stringify(data));
    },

    // 初始化日期显示
    initDate() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        document.getElementById('currentDate').textContent = `${month}月${day}日`;
        
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        document.getElementById('currentWeekday').textContent = weekdays[now.getDay()];
    },

    // 获取天气数据 - 使用和风天气API
    async fetchWeather() {
        try {
            // 和风天气API配置
            const key = '0c8b926f5c9d477c83cb0e9fe7afbce3';
            const location = this.currentCity.code;
            
            // 使用 Promise.race 添加5秒超时
            const response = await Promise.race([
                fetch(`https://mu44uanw8g.re.qweatherapi.com/v7/weather/now?location=${location}&key=${key}`),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Weather timeout')), 5000)
                )
            ]);
            
            if (!response.ok) throw new Error('Weather fetch failed');
            
            const data = await response.json();
            
            if (data.code === '200' && data.now) {
                const now = data.now;
                const temp = now.temp + '°';
                const condition = now.text;
                const humidity = now.humidity + '%';
                const wind = now.windDir + ' ' + now.windScale + '级';
                
                document.getElementById('weatherTemp').textContent = temp;
                document.getElementById('weatherStatus').textContent = condition;
                document.getElementById('weatherDetail').textContent = `湿度 ${humidity} · ${wind}`;
                
                const icon = this.getWeatherIcon(condition);
                document.getElementById('weatherIcon').textContent = icon;
                
                // 更新温馨提示
                updateWeatherTip(now.temp, condition);
            } else {
                throw new Error('Invalid weather data');
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
            // 显示默认天气信息
            document.getElementById('weatherTemp').textContent = '--°';
            document.getElementById('weatherStatus').textContent = '获取失败';
            document.getElementById('weatherDetail').textContent = '点击刷新按钮重试';
        }
    },

    // 根据天气状况获取图标
    getWeatherIcon(condition) {
        const iconMap = {
            'Sunny': '☀️', 'Clear': '☀️', 'Partly cloudy': '⛅',
            'Cloudy': '☁️', 'Overcast': '☁️', 'Rain': '🌧️',
            'Light rain': '🌦️', 'Heavy rain': '⛈️', 'Snow': '❄️',
            'Thunderstorm': '⛈️', 'Fog': '🌫️', 'Mist': '🌫️'
        };
        
        for (const [key, icon] of Object.entries(iconMap)) {
            if (condition.toLowerCase().includes(key.toLowerCase())) return icon;
        }
        return '🌤️';
    },

    // ==================== 待办功能 ====================
    renderTodos() {
        const listEl = document.getElementById('todoList');
        
        if (this.todos.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">暂无待办事项</div>
                    <div class="empty-hint">添加你的第一个任务吧</div>
                </div>`;
            return;
        }
        
        const sortedTodos = [...this.todos].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        listEl.innerHTML = sortedTodos.map(todo => this.renderTodoItem(todo)).join('');
    },

    renderTodoItem(todo) {
        const subtaskCount = todo.subtasks ? todo.subtasks.length : 0;
        const completedSubtasks = todo.subtasks ? todo.subtasks.filter(s => s.done).length : 0;
        const hasSubtasks = subtaskCount > 0;
        
        let subtasksHtml = '';
        if (todo.expanded) {
            subtasksHtml = `
                <div class="subtask-list">
                    <div class="subtask-list-header">📋 子任务 (${completedSubtasks}/${subtaskCount})</div>
                    ${hasSubtasks ? todo.subtasks.map(sub => `
                        <div class="subtask-item ${sub.done ? 'done' : ''}">
                            <div class="subtask-checkbox ${sub.done ? 'checked' : ''}" 
                                 onclick="App.toggleSubtask('${todo.id}', '${sub.id}')">
                                ${sub.done ? '✓' : ''}
                            </div>
                            <span class="subtask-text">${this.escapeHtml(sub.text)}</span>
                            <button class="subtask-delete" onclick="App.deleteSubtask('${todo.id}', '${sub.id}')">×</button>
                        </div>
                    `).join('') : '<div style="color: var(--text-muted); font-size: 14px; padding: 8px 0;">暂无子任务</div>'}
                    <div class="subtask-input-area">
                        <input type="text" class="subtask-input" 
                               placeholder="添加子任务..." 
                               onkeypress="App.handleSubtaskEnter(event, '${todo.id}')"
                               id="subtask-input-${todo.id}">
                        <button class="btn-subtask-add" onclick="App.addSubtask('${todo.id}')">+</button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="todo-item ${todo.done ? 'done' : ''}" data-id="${todo.id}">
                <div class="todo-main">
                    <div class="todo-checkbox ${todo.done ? 'checked' : ''}" onclick="App.toggleTodo('${todo.id}')">
                        ${todo.done ? '✓' : ''}
                    </div>
                    <span class="todo-text ${todo.done ? 'completed' : ''}">${this.escapeHtml(todo.text)}</span>
                    <span class="todo-priority priority-${todo.priority}">${this.getPriorityLabel(todo.priority)}</span>
                    ${hasSubtasks ? `<span class="subtask-badge">${completedSubtasks}/${subtaskCount}</span>` : ''}
                    <button class="todo-toggle" onclick="App.toggleSubtaskView('${todo.id}')">${todo.expanded ? '▼' : '▶'}</button>
                    <button class="todo-delete" onclick="App.deleteTodo('${todo.id}')">🗑️</button>
                </div>
                ${subtasksHtml}
            </div>
        `;
    },

    getPriorityLabel(priority) {
        return { high: '高', medium: '中', low: '低' }[priority] || '中';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    addTodo() {
        const input = document.getElementById('todoInput');
        const priorityValue = document.getElementById('priorityValue');
        const text = input.value.trim();
        
        if (!text) { input.focus(); return; }
        
        this.todos.push({
            id: Date.now().toString(),
            text: text,
            priority: priorityValue.value,
            done: false,
            createdAt: new Date().toISOString(),
            subtasks: [],
            expanded: false
        });
        
        this.saveData();
        this.renderTodos();
        this.updateStats();
        input.value = '';
        input.focus();
    },

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.done = !todo.done;
            this.saveData();
            this.renderTodos();
            this.updateStats();
        }
    },

    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveData();
        this.renderTodos();
        this.updateStats();
    },

    // 子任务功能
    toggleSubtaskView(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo) {
            todo.expanded = !todo.expanded;
            this.saveData();
            this.renderTodos();
        }
    },

    addSubtask(todoId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo) return;
        
        const input = document.getElementById(`subtask-input-${todoId}`);
        const text = input.value.trim();
        
        if (!text) return;
        
        if (!todo.subtasks) todo.subtasks = [];
        
        todo.subtasks.push({
            id: Date.now().toString(),
            text: text,
            done: false
        });
        
        this.saveData();
        this.renderTodos();
    },

    handleSubtaskEnter(event, todoId) {
        if (event.key === 'Enter') {
            this.addSubtask(todoId);
        }
    },

    toggleSubtask(todoId, subtaskId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo || !todo.subtasks) return;
        
        const subtask = todo.subtasks.find(s => s.id === subtaskId);
        if (subtask) {
            subtask.done = !subtask.done;
            
            // 检查是否所有子任务完成
            const allDone = todo.subtasks.every(s => s.done);
            if (allDone && !todo.done) {
                todo.done = true;
            } else if (!allDone && todo.done) {
                todo.done = false;
            }
            
            this.saveData();
            this.renderTodos();
            this.updateStats();
        }
    },

    deleteSubtask(todoId, subtaskId) {
        const todo = this.todos.find(t => t.id === todoId);
        if (!todo || !todo.subtasks) return;
        
        todo.subtasks = todo.subtasks.filter(s => s.id !== subtaskId);
        this.saveData();
        this.renderTodos();
    },

    clearCompleted() {
        const completedCount = this.todos.filter(t => t.done).length;
        if (completedCount === 0) return;
        
        if (confirm(`确定要清除 ${completedCount} 个已完成的待办吗？`)) {
            this.todos = this.todos.filter(t => !t.done);
            this.saveData();
            this.renderTodos();
            this.updateStats();
        }
    },

    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.done).length;
        const remaining = total - completed;
        
        document.getElementById('todoTotal').textContent = total;
        document.getElementById('todoCompleted').textContent = completed;
        document.getElementById('todoRemaining').textContent = remaining;
        document.getElementById('todoCount').textContent = remaining;
    },

    bindEvents() {
        document.getElementById('todoInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
    },

    // ==================== 工具功能 ====================
    initTools() {
        // 工具已初始化
    },

    // 打开工具模态框
    openTool(tool) {
        const modal = document.getElementById('toolModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        
        modal.classList.add('active');
        
        switch(tool) {
            case 'pomodoro':
                title.textContent = '⏱️ 番茄钟';
                body.innerHTML = this.getPomodoroHTML();
                this.initPomodoro();
                break;
            case 'calculator':
                title.textContent = '🧮 计算器';
                body.innerHTML = this.getCalculatorHTML();
                this.initCalculator();
                break;
            case 'countdown':
                title.textContent = '⏳ 倒计时';
                body.innerHTML = this.getCountdownHTML();
                this.initCountdown();
                break;
            case 'note':
                title.textContent = '📝 快速笔记';
                body.innerHTML = this.getNoteHTML();
                this.initNotes();
                break;
            case 'calendar':
                title.textContent = '📅 日历';
                body.innerHTML = this.getCalendarHTML();
                this.initCalendar();
                break;
        }
    },

    // 关闭工具模态框
    closeTool() {
        document.getElementById('toolModal').classList.remove('active');
        // 清理计时器
        if (this.pomodoro.timer) clearInterval(this.pomodoro.timer);
        if (this.countdown.timer) clearInterval(this.countdown.timer);
    },

    // ==================== 番茄钟 ====================
    getPomodoroHTML() {
        const todayFocus = Math.floor(this.pomodoro.totalFocusTime / 60);
        return `
            <div class="pomodoro-container">
                <!-- 进度环 -->
                <div class="pomodoro-ring-container">
                    <svg class="pomodoro-ring" viewBox="0 0 200 200">
                        <circle class="pomodoro-ring-bg" cx="100" cy="100" r="90"/>
                        <circle class="pomodoro-ring-progress" id="pomoRing" cx="100" cy="100" r="90"/>
                    </svg>
                    <div class="pomodoro-center">
                        <div class="pomodoro-time" id="pomoTime">25:00</div>
                        <div class="pomodoro-status" id="pomoStatus">准备专注</div>
                    </div>
                </div>
                
                <!-- 任务标签 -->
                <div class="pomodoro-task">
                    <input type="text" id="pomoTask" placeholder="正在专注..." 
                           value="${this.pomodoro.currentTask}"
                           oninput="App.pomodoro.currentTask = this.value">
                </div>
                
                <!-- 控制按钮 -->
                <div class="pomodoro-controls">
                    <button class="pomodoro-btn secondary" onclick="App.skipPomodoro()" title="跳过">⏭️</button>
                    <button class="pomodoro-btn primary" id="pomoStart" onclick="App.startPomodoro()">开始专注</button>
                    <button class="pomodoro-btn secondary" onclick="App.resetPomodoro()" title="重置">🔄</button>
                </div>
                
                <!-- 时间设置 -->
                <div class="pomodoro-settings">
                    <div class="pomodoro-setting-item">
                        <label>专注</label>
                        <div class="pomodoro-setting-control">
                            <button onclick="App.adjustTime('work', -5)">−</button>
                            <span id="pomoWorkTime">${this.pomodoro.workDuration}</span>
                            <button onclick="App.adjustTime('work', 5)">+</button>
                        </div>
                        <span>分钟</span>
                    </div>
                    <div class="pomodoro-setting-item">
                        <label>短休息</label>
                        <div class="pomodoro-setting-control">
                            <button onclick="App.adjustTime('shortBreak', -1)">−</button>
                            <span id="pomoShortBreak">${this.pomodoro.shortBreak}</span>
                            <button onclick="App.adjustTime('shortBreak', 1)">+</button>
                        </div>
                        <span>分钟</span>
                    </div>
                    <div class="pomodoro-setting-item">
                        <label>长休息</label>
                        <div class="pomodoro-setting-control">
                            <button onclick="App.adjustTime('longBreak', -5)">−</button>
                            <span id="pomoLongBreak">${this.pomodoro.longBreak}</span>
                            <button onclick="App.adjustTime('longBreak', 5)">+</button>
                        </div>
                        <span>分钟</span>
                    </div>
                </div>
                
                <!-- 今日统计 -->
                <div class="pomodoro-stats">
                    <div class="pomodoro-stat">
                        <div class="pomodoro-stat-value" id="pomoCompleted">${this.pomodoro.completed}</div>
                        <div class="pomodoro-stat-label">完成番茄</div>
                    </div>
                    <div class="pomodoro-stat">
                        <div class="pomodoro-stat-value" id="pomoTotalFocus">${todayFocus}</div>
                        <div class="pomodoro-stat-label">专注分钟</div>
                    </div>
                    <div class="pomodoro-stat">
                        <div class="pomodoro-stat-value" id="pomoSession">${this.pomodoro.sessionCount}/4</div>
                        <div class="pomodoro-stat-label">当前轮次</div>
                    </div>
                </div>
                
                <!-- 提示 -->
                <div class="pomodoro-tip" id="pomoTip">
                    💡 每4个番茄后享受一次长休息
                </div>
            </div>
        `;
    },

    initPomodoro() {
        this.updatePomodoroDisplay();
        this.updatePomodoroRing();
    },

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.pomodoro.timeLeft / 60);
        const seconds = this.pomodoro.timeLeft % 60;
        document.getElementById('pomoTime').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.updatePomodoroRing();
    },

    updatePomodoroRing() {
        const ring = document.getElementById('pomoRing');
        if (!ring) return;
        
        const totalTime = this.pomodoro.isBreak 
            ? (this.pomodoro.sessionCount >= 4 ? this.pomodoro.longBreak : this.pomodoro.shortBreak) * 60
            : this.pomodoro.workDuration * 60;
        const progress = this.pomodoro.timeLeft / totalTime;
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - progress);
        
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = offset;
        
        // 根据状态改变颜色
        if (this.pomodoro.isBreak) {
            ring.classList.add('break-mode');
        } else {
            ring.classList.remove('break-mode');
        }
    },

    adjustTime(type, delta) {
        if (this.pomodoro.isRunning) return; // 运行中不允许调整
        
        const min = type === 'work' ? 5 : 1;
        const max = type === 'work' ? 60 : 30;
        
        this.pomodoro[type] = Math.max(min, Math.min(max, this.pomodoro[type] + delta));
        
        // 更新显示
        const idMap = { work: 'pomoWorkTime', shortBreak: 'pomoShortBreak', longBreak: 'pomoLongBreak' };
        document.getElementById(idMap[type]).textContent = this.pomodoro[type];
        
        // 如果调整的是专注时间，更新倒计时
        if (type === 'work' && !this.pomodoro.isBreak) {
            this.pomodoro.timeLeft = this.pomodoro.workDuration * 60;
            this.updatePomodoroDisplay();
        }
    },

    playSound(type) {
        try {
            if (!this.pomodoro.audioContext) {
                this.pomodoro.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const ctx = this.pomodoro.audioContext;
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            if (type === 'complete') {
                // 完成音效 - 上升音调
                oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.5);
            } else if (type === 'tick') {
                // 滴答声
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.05);
            }
        } catch (e) {
            console.log('Audio not supported');
        }
    },

    startPomodoro() {
        if (this.pomodoro.isRunning) {
            // 暂停
            clearInterval(this.pomodoro.timer);
            this.pomodoro.isRunning = false;
            this.pomodoro.isPaused = true;
            document.getElementById('pomoStart').textContent = '继续';
            document.getElementById('pomoStatus').textContent = '已暂停';
        } else {
            // 开始
            this.pomodoro.isRunning = true;
            this.pomodoro.isPaused = false;
            document.getElementById('pomoStart').textContent = '暂停';
            
            if (this.pomodoro.isBreak) {
                document.getElementById('pomoStatus').textContent = '☕ 休息中...';
                document.getElementById('pomoTip').textContent = '放松一下，喝杯水吧';
            } else {
                document.getElementById('pomoStatus').textContent = '🎯 专注中...';
                const task = this.pomodoro.currentTask || '正在专注';
                document.getElementById('pomoTip').textContent = `当前任务：${task}`;
            }
            
            this.pomodoro.timer = setInterval(() => {
                this.pomodoro.timeLeft--;
                
                // 记录专注时间
                if (!this.pomodoro.isBreak) {
                    this.pomodoro.totalFocusTime++;
                }
                
                this.updatePomodoroDisplay();
                
                // 最后10秒播放滴答声
                if (this.pomodoro.timeLeft <= 10 && this.pomodoro.timeLeft > 0) {
                    this.playSound('tick');
                }
                
                if (this.pomodoro.timeLeft <= 0) {
                    this.completePomodoro();
                }
            }, 1000);
        }
    },

    completePomodoro() {
        clearInterval(this.pomodoro.timer);
        this.pomodoro.isRunning = false;
        this.playSound('complete');
        
        if (!this.pomodoro.isBreak) {
            // 完成专注
            this.pomodoro.completed++;
            this.pomodoro.sessionCount++;
            this.saveData();
            
            document.getElementById('pomoCompleted').textContent = this.pomodoro.completed;
            document.getElementById('pomoTotalFocus').textContent = Math.floor(this.pomodoro.totalFocusTime / 60);
            document.getElementById('pomoSession').textContent = `${this.pomodoro.sessionCount}/4`;
            
            // 判断是否需要长休息
            if (this.pomodoro.sessionCount >= 4) {
                this.pomodoro.timeLeft = this.pomodoro.longBreak * 60;
                this.pomodoro.isBreak = true;
                this.pomodoro.sessionCount = 0;
                document.getElementById('pomoSession').textContent = '0/4';
                document.getElementById('pomoTip').textContent = '🎉 连续4个番茄！享受${this.pomodoro.longBreak}分钟长休息吧';
            } else {
                this.pomodoro.timeLeft = this.pomodoro.shortBreak * 60;
                this.pomodoro.isBreak = true;
                document.getElementById('pomoTip').textContent = '✅ 专注完成！休息一下吧';
            }
        } else {
            // 完成休息
            this.pomodoro.timeLeft = this.pomodoro.workDuration * 60;
            this.pomodoro.isBreak = false;
            document.getElementById('pomoTip').textContent = '💪 休息结束，继续加油！';
        }
        
        this.updatePomodoroDisplay();
        document.getElementById('pomoStart').textContent = '开始专注';
        document.getElementById('pomoStatus').textContent = this.pomodoro.isBreak ? '☕ 休息时间' : '🎯 准备专注';
    },

    skipPomodoro() {
        if (confirm('确定要跳过当前阶段吗？')) {
            this.completePomodoro();
        }
    },

    resetPomodoro() {
        clearInterval(this.pomodoro.timer);
        this.pomodoro.isRunning = false;
        this.pomodoro.isPaused = false;
        this.pomodoro.isBreak = false;
        this.pomodoro.timeLeft = this.pomodoro.workDuration * 60;
        this.updatePomodoroDisplay();
        document.getElementById('pomoStart').textContent = '开始专注';
        document.getElementById('pomoStatus').textContent = '准备专注';
        document.getElementById('pomoTip').textContent = '💡 每4个番茄后享受一次长休息';
    },

    // ==================== 计算器 ====================
    getCalculatorHTML() {
        return `
            <div class="calculator">
                <div class="calc-display">
                    <div class="calc-expression" id="calcExpr"></div>
                    <div class="calc-result" id="calcResult">0</div>
                </div>
                <div class="calc-buttons">
                    <button class="calc-btn clear" onclick="App.calcClear()">C</button>
                    <button class="calc-btn" onclick="App.calcInput('(')">(</button>
                    <button class="calc-btn" onclick="App.calcInput(')')">)</button>
                    <button class="calc-btn operator" onclick="App.calcInput('/')">÷</button>
                    
                    <button class="calc-btn" onclick="App.calcInput('7')">7</button>
                    <button class="calc-btn" onclick="App.calcInput('8')">8</button>
                    <button class="calc-btn" onclick="App.calcInput('9')">9</button>
                    <button class="calc-btn operator" onclick="App.calcInput('*')">×</button>
                    
                    <button class="calc-btn" onclick="App.calcInput('4')">4</button>
                    <button class="calc-btn" onclick="App.calcInput('5')">5</button>
                    <button class="calc-btn" onclick="App.calcInput('6')">6</button>
                    <button class="calc-btn operator" onclick="App.calcInput('-')">-</button>
                    
                    <button class="calc-btn" onclick="App.calcInput('1')">1</button>
                    <button class="calc-btn" onclick="App.calcInput('2')">2</button>
                    <button class="calc-btn" onclick="App.calcInput('3')">3</button>
                    <button class="calc-btn operator" onclick="App.calcInput('+')">+</button>
                    
                    <button class="calc-btn" onclick="App.calcInput('0')">0</button>
                    <button class="calc-btn" onclick="App.calcInput('.')">.</button>
                    <button class="calc-btn equals" onclick="App.calcEquals()">=</button>
                </div>
            </div>
        `;
    },

    initCalculator() {
        this.calculator.expression = '';
        this.calculator.result = '0';
    },

    calcInput(val) {
        this.calculator.expression += val;
        document.getElementById('calcExpr').textContent = this.calculator.expression;
    },

    calcClear() {
        this.calculator.expression = '';
        this.calculator.result = '0';
        document.getElementById('calcExpr').textContent = '';
        document.getElementById('calcResult').textContent = '0';
    },

    calcEquals() {
        try {
            // 替换显示符号为实际运算符
            const expr = this.calculator.expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            
            this.calculator.result = eval(expr).toString();
            document.getElementById('calcResult').textContent = this.calculator.result;
            this.calculator.expression = '';
            document.getElementById('calcExpr').textContent = '';
        } catch (e) {
            document.getElementById('calcResult').textContent = 'Error';
        }
    },

    // ==================== 倒计时 ====================
    getCountdownHTML() {
        return `
            <div class="countdown-setup" id="countdownSetup">
                <div class="countdown-inputs">
                    <div class="countdown-input-group">
                        <input type="number" id="cdHours" min="0" max="23" value="0">
                        <label>小时</label>
                    </div>
                    <div class="countdown-input-group">
                        <input type="number" id="cdMinutes" min="0" max="59" value="5">
                        <label>分钟</label>
                    </div>
                    <div class="countdown-input-group">
                        <input type="number" id="cdSeconds" min="0" max="59" value="0">
                        <label>秒</label>
                    </div>
                </div>
                <div class="countdown-controls">
                    <button class="pomodoro-btn primary" onclick="App.startCountdown()">开始倒计时</button>
                </div>
            </div>
            <div class="countdown-display" id="countdownDisplay" style="display: none;">
                <div class="countdown-time" id="cdTime">00:00:00</div>
                <div class="countdown-controls" style="margin-top: 32px;">
                    <button class="pomodoro-btn secondary" id="cdPause" onclick="App.pauseCountdown()">暂停</button>
                    <button class="pomodoro-btn secondary" onclick="App.resetCountdown()">重置</button>
                </div>
            </div>
        `;
    },

    initCountdown() {
        // 初始化
    },

    startCountdown() {
        const hours = parseInt(document.getElementById('cdHours').value) || 0;
        const minutes = parseInt(document.getElementById('cdMinutes').value) || 0;
        const seconds = parseInt(document.getElementById('cdSeconds').value) || 0;
        
        this.countdown.timeLeft = hours * 3600 + minutes * 60 + seconds;
        
        if (this.countdown.timeLeft <= 0) {
            alert('请设置有效的时间');
            return;
        }
        
        document.getElementById('countdownSetup').style.display = 'none';
        document.getElementById('countdownDisplay').style.display = 'block';
        
        this.countdown.isRunning = true;
        this.updateCountdownDisplay();
        
        this.countdown.timer = setInterval(() => {
            this.countdown.timeLeft--;
            this.updateCountdownDisplay();
            
            if (this.countdown.timeLeft <= 0) {
                this.completeCountdown();
            }
        }, 1000);
    },

    updateCountdownDisplay() {
        const hours = Math.floor(this.countdown.timeLeft / 3600);
        const minutes = Math.floor((this.countdown.timeLeft % 3600) / 60);
        const seconds = this.countdown.timeLeft % 60;
        
        document.getElementById('cdTime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    pauseCountdown() {
        if (this.countdown.isRunning) {
            clearInterval(this.countdown.timer);
            this.countdown.isRunning = false;
            document.getElementById('cdPause').textContent = '继续';
        } else {
            this.countdown.isRunning = true;
            document.getElementById('cdPause').textContent = '暂停';
            this.countdown.timer = setInterval(() => {
                this.countdown.timeLeft--;
                this.updateCountdownDisplay();
                if (this.countdown.timeLeft <= 0) this.completeCountdown();
            }, 1000);
        }
    },

    resetCountdown() {
        clearInterval(this.countdown.timer);
        this.countdown.isRunning = false;
        document.getElementById('countdownSetup').style.display = 'block';
        document.getElementById('countdownDisplay').style.display = 'none';
        document.getElementById('cdPause').textContent = '暂停';
    },

    completeCountdown() {
        clearInterval(this.countdown.timer);
        this.countdown.isRunning = false;
        alert('⏰ 倒计时结束！');
        this.resetCountdown();
    },

    // ==================== 快速笔记 ====================
    getNoteHTML() {
        return `
            <div class="note-editor">
                <textarea class="note-textarea" id="noteInput" placeholder="记录你的想法..."></textarea>
            </div>
            <div class="note-actions">
                <button class="btn btn-primary" onclick="App.addNote()">💾 保存笔记</button>
                <button class="btn btn-secondary" onclick="App.clearNoteInput()">清空</button>
            </div>
            <div class="note-list" id="noteList">
                <!-- 笔记列表 -->
            </div>
        `;
    },

    initNotes() {
        this.renderNotes();
    },

    renderNotes() {
        const listEl = document.getElementById('noteList');
        
        if (this.notes.length === 0) {
            listEl.innerHTML = `
                <div class="note-empty">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <div>还没有笔记</div>
                    <div style="font-size: 14px; margin-top: 8px; opacity: 0.7;">写下你的第一个想法吧</div>
                </div>`;
            return;
        }
        
        const sortedNotes = [...this.notes].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        listEl.innerHTML = sortedNotes.map(note => {
            const date = new Date(note.createdAt);
            const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            const preview = note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text;
            
            return `
                <div class="note-item" onclick="App.loadNote('${note.id}')">
                    <div class="note-item-header">
                        <span class="note-item-time">${timeStr}</span>
                        <button class="note-item-delete" onclick="event.stopPropagation(); App.deleteNote('${note.id}')">✕</button>
                    </div>
                    <div class="note-item-preview">${this.escapeHtml(preview)}</div>
                </div>
            `;
        }).join('');
    },

    addNote() {
        const input = document.getElementById('noteInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        this.notes.push({
            id: Date.now().toString(),
            text: text,
            createdAt: new Date().toISOString()
        });
        
        this.saveData();
        input.value = '';
        this.renderNotes();
    },

    loadNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            document.getElementById('noteInput').value = note.text;
        }
    },

    deleteNote(id) {
        if (confirm('确定要删除这条笔记吗？')) {
            this.notes = this.notes.filter(n => n.id !== id);
            this.saveData();
            this.renderNotes();
        }
    },

    clearNoteInput() {
        document.getElementById('noteInput').value = '';
    },

    // ==================== 日历 ====================
    getCalendarHTML() {
        return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-nav" onclick="App.prevMonth()">◀</button>
                    <span class="calendar-title" id="calendarTitle">2026年3月</span>
                    <button class="calendar-nav" onclick="App.nextMonth()">▶</button>
                </div>
                <div class="calendar-weekdays">
                    <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                </div>
                <div class="calendar-days" id="calendarDays"></div>
            </div>
        `;
    },

    initCalendar() {
        this.calendarDate = new Date();
        this.renderCalendar();
    },

    renderCalendar() {
        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        
        document.getElementById('calendarTitle').textContent = `${year}年${month + 1}月`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        
        let html = '';
        
        // 空白格子
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // 日期格子
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = year === today.getFullYear() && 
                           month === today.getMonth() && 
                           day === today.getDate();
            
            html += `<div class="calendar-day ${isToday ? 'today' : ''}">${day}</div>`;
        }
        
        document.getElementById('calendarDays').innerHTML = html;
    },

    prevMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.renderCalendar();
    },

    nextMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.renderCalendar();
    }
};

// ==================== 全局函数 ====================

function switchTab(tab) {
    App.currentTab = tab;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    document.getElementById('todoView').style.display = tab === 'todo' ? 'block' : 'none';
    document.getElementById('toolsView').style.display = tab === 'tools' ? 'block' : 'none';
}

function handleEnter(event) {
    if (event.key === 'Enter') App.addTodo();
}

function focusInput() {
    document.getElementById('todoInput').focus();
}

function refreshWeather() {
    document.getElementById('weatherStatus').textContent = '刷新中...';
    App.fetchWeather();
}

function clearCompleted() {
    App.clearCompleted();
}

function addTodo() {
    App.addTodo();
}

function selectPriority(priority) {
    // 更新隐藏input的值
    document.getElementById('priorityValue').value = priority;
    
    // 更新按钮状态
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.priority === priority) {
            btn.classList.add('active');
        }
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function openLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function openTool(tool) {
    App.openTool(tool);
}

function closeTool() {
    App.closeTool();
}

// ==================== 城市切换 ====================

function changeCity(cityCode) {
    if (cityCode === 'auto') {
        // 自动定位
        autoLocate();
    } else {
        // 手动选择城市
        App.currentCity.code = cityCode;
        App.currentCity.name = App.cityMap[cityCode] || '未知';
        updateWeatherDisplay();
        // 保存选择
        localStorage.setItem('dashboard_city', cityCode);
    }
}

function autoLocate() {
    if (!navigator.geolocation) {
        alert('您的浏览器不支持地理定位');
        document.getElementById('citySelect').value = App.currentCity.code;
        return;
    }
    
    document.getElementById('weatherCityTitle').textContent = '定位中...';
    document.getElementById('weatherStatus').textContent = '获取位置...';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // 定位成功，使用经纬度查询天气
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeatherByCoords(lat, lon);
        },
        (error) => {
            // 定位失败
            console.error('定位失败:', error);
            alert('定位失败，请手动选择城市');
            document.getElementById('citySelect').value = App.currentCity.code;
            document.getElementById('weatherCityTitle').textContent = App.currentCity.name;
            App.fetchWeather();
        },
        {
            timeout: 10000,
            enableHighAccuracy: false
        }
    );
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        const key = '0c8b926f5c9d477c83cb0e9fe7afbce3';
        // 使用经纬度查询天气
        const response = await Promise.race([
            fetch(`https://mu44uanw8g.re.qweatherapi.com/v7/weather/now?location=${lon},${lat}&key=${key}`),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Weather timeout')), 5000)
            )
        ]);
        
        if (!response.ok) throw new Error('Weather fetch failed');
        
        const data = await response.json();
        
        if (data.code === '200' && data.now) {
            const now = data.now;
            App.currentCity.name = '本地';
            App.currentCity.code = 'auto';
            
            document.getElementById('weatherCityTitle').textContent = '本地';
            document.getElementById('weatherTemp').textContent = now.temp + '°';
            document.getElementById('weatherStatus').textContent = now.text;
            document.getElementById('weatherDetail').textContent = `湿度 ${now.humidity}% · ${now.windDir} ${now.windScale}级`;
            
            const icon = App.getWeatherIcon(now.text);
            document.getElementById('weatherIcon').textContent = icon;
            
            localStorage.setItem('dashboard_city', 'auto');
        } else {
            throw new Error('Invalid weather data');
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        alert('获取天气失败，请手动选择城市');
        document.getElementById('citySelect').value = '101210101';
        changeCity('101210101');
    }
}

function updateWeatherDisplay() {
    document.getElementById('weatherCityTitle').textContent = App.currentCity.name;
    App.fetchWeather();
}

// 加载保存的城市
function loadCity() {
    const savedCity = localStorage.getItem('dashboard_city');
    if (savedCity) {
        if (savedCity === 'auto') {
            // 上次是自动定位，尝试重新定位
            autoLocate();
        } else {
            document.getElementById('citySelect').value = savedCity;
            App.currentCity.code = savedCity;
            App.currentCity.name = App.cityMap[savedCity] || '杭州';
            document.getElementById('weatherCityTitle').textContent = App.currentCity.name;
        }
    }
}

// ==================== 温馨提示 ====================

function updateWeatherTip(temp, condition) {
    const tipEl = document.getElementById('weatherTip');
    const iconEl = tipEl.querySelector('.weather-tip-icon');
    const textEl = tipEl.querySelector('.weather-tip-text');
    
    const tempNum = parseInt(temp);
    const conditionLower = condition.toLowerCase();
    
    // 判断天气状况
    const isRain = /雨|雪|雹|霰/.test(condition);
    const isStorm = /雷|暴|大风|台风/.test(condition);
    const isExtreme = /雾|霾|沙尘/.test(condition);
    
    let tipClass = 'normal';
    let tipIcon = '💡';
    let tipText = '';
    
    if (isStorm) {
        // 极端天气
        tipClass = 'rain';
        tipIcon = '⚠️';
        tipText = '天气异常，请注意人身安全，尽量减少外出';
    } else if (isRain) {
        // 雨雪天气
        tipClass = 'rain';
        tipIcon = '☔';
        tipText = '今天有雨，出门记得带伞，注意防滑';
    } else if (isExtreme) {
        // 雾霾沙尘
        tipClass = 'rain';
        tipIcon = '😷';
        tipText = '空气质量不佳，外出请佩戴口罩，注意防护';
    } else if (tempNum <= 5) {
        // 寒冷天气
        tipClass = 'cold';
        tipIcon = '🧥';
        tipText = '天气寒冷，请注意保暖，多穿衣服别着凉';
    } else if (tempNum >= 35) {
        // 炎热天气
        tipClass = 'hot';
        tipIcon = '💧';
        tipText = '天气炎热，注意防暑降温，多喝水避免中暑';
    } else if (tempNum >= 30) {
        // 较热天气
        tipClass = 'hot';
        tipIcon = '🌞';
        tipText = '天气较热，注意防晒补水，适当休息';
    } else if (tempNum <= 10) {
        // 较冷天气
        tipClass = 'cold';
        tipIcon = '🧣';
        tipText = '天气较凉，注意添衣保暖，预防感冒';
    } else {
        // 舒适天气
        tipClass = 'normal';
        tipIcon = '✨';
        tipText = '天气舒适，适合外出活动，祝您有美好的一天';
    }
    
    // 更新提示样式和内容
    tipEl.className = 'weather-tip ' + tipClass;
    iconEl.textContent = tipIcon;
    textEl.textContent = tipText;
}

// ==================== 主题切换 ====================

function toggleThemePanel() {
    document.getElementById('themePanel').classList.toggle('active');
}

function setTheme(theme) {
    // 设置主题
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // 保存到localStorage
    localStorage.setItem('dashboard_theme', theme);
    
    // 更新选中状态
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        }
    });
    
    // 关闭面板
    document.getElementById('themePanel').classList.remove('active');
}

// 加载保存的主题
function loadTheme() {
    const savedTheme = localStorage.getItem('dashboard_theme');
    if (savedTheme) {
        setTheme(savedTheme);
    }
}

// 点击面板外部关闭
document.addEventListener('click', (e) => {
    const panel = document.getElementById('themePanel');
    const btn = document.querySelector('.header-btn[onclick="toggleThemePanel()"]');
    
    if (panel && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.remove('active');
    }
});

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    loadTheme();
    loadCity();
});

// 每分钟刷新日期
setInterval(() => App.initDate(), 60000);

// 每30分钟刷新天气
setInterval(() => App.fetchWeather(), 1800000);