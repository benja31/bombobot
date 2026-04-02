const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

// basic configuration
const CONFIG = {
  botFile: './index.js',
  logBuffer: [],
  maxLogLines: 100,
  refreshInterval: 500, // ms
};

const ASCII_ART = `
                                                       __ 
             /  _/_     / o o                            )
 ____  o _. /_  /  _   /_  __ ____  ____  _  __   , _.--' 
/ / <_<_(__/ /_<__/_)_/ <_(_)/ / <_/ / <_</_/ (_  \/(__                                                                                                                                       
`;

// initial state
let botProcess = null;
let startTime = null;
let isRunning = false;
let lastRenderTime = 0;
const RENDER_THROTTLE = 200;
let rl = null;

// only used to display the bots uptime correctly formatted
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// used to display terminal colors
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// equivalent to cls or clear
function clearScreen() {
  process.stdout.write('\x18c'); // ansi escape sequence
}

function renderDisplay(force = false) {
  if (!isRunning && !force) return;

  const now = Date.now();
  // Throttle renders to avoid conflicts with input
  if (!force && now - lastRenderTime < RENDER_THROTTLE) return;
  lastRenderTime = now;

  const uptime = startTime ? Date.now() - startTime : 0;
  
  // Move cursor to top without clearing (preserves scrollback)
  process.stdout.write('\x1B[H');
  
  // Print ASCII Art only once per session
  if (!renderDisplay.asciiPrinted && force) {
    console.log(ASCII_ART);
    renderDisplay.asciiPrinted = true;
  }

  // Status Bar (fixed position, always redrawn)
  const status = botProcess && botProcess.exitCode === null ? 
    `${COLORS.green}● RUNNING${COLORS.reset}` : 
    `${COLORS.red}○ STOPPED${COLORS.reset}`;
    
  process.stdout.write(`${COLORS.cyan}${'═'.repeat(65)}${COLORS.reset}\r\n`);
  process.stdout.write(`${COLORS.bold}${COLORS.white}STATUS:${COLORS.reset} ${status} | ` +
                       `${COLORS.bold}${COLORS.white}UPTIME:${COLORS.reset} ${formatUptime(uptime)} | ` +
                       `${COLORS.bold}${COLORS.white}COMMANDS:${COLORS.reset} ${clientCommandsCount || 'N/A'}\r\n`);
  process.stdout.write(`${COLORS.cyan}${'═'.repeat(65)}${COLORS.reset}\r\n\r\n`);

  // Log Header (fixed)
  process.stdout.write(`${COLORS.yellow}▶ BOT LOGS${COLORS.reset}\r\n`);
  process.stdout.write(`${COLORS.gray}${'─'.repeat(65)}${COLORS.reset}\r\n`);
  
  // Calculate how many log lines fit on screen (approximate)
  const terminalHeight = process.stdout.rows || 24;
  const headerLines = 18; // ASCII art + status bar + headers
  const availableLogLines = Math.max(5, terminalHeight - headerLines - 3);
  
  if (CONFIG.logBuffer.length === 0) {
    process.stdout.write(`${COLORS.gray}  Waiting for bot to start...${COLORS.reset}\r\n\r\n`);
  } else {
    // Show last N lines that fit on screen
    const startIdx = Math.max(0, CONFIG.logBuffer.length - availableLogLines);
    const visibleLogs = CONFIG.logBuffer.slice(startIdx);
    
    visibleLogs.forEach((line) => {
      let coloredLine = line;
      if (line.includes('ERROR')) coloredLine = `${COLORS.red}${line}${COLORS.reset}`;
      else if (line.includes('WARNING')) coloredLine = `${COLORS.yellow}${line}${COLORS.reset}`;
      else if (line.includes('[IPC]')) coloredLine = `${COLORS.cyan}${line}${COLORS.reset}`;
      
      process.stdout.write(`${COLORS.gray}  ${String(visibleLogs.length).padStart(2, '0')}│${COLORS.reset} ${coloredLine}\r\n`);
    });
  }

  // Bottom separator (fixed)
  process.stdout.write(`\r\n${'─'.repeat(65)}\r\n`);
  
  // Return cursor position for readline to use
  return terminalHeight - 2;
}

function startBot() {
  clearScreen();
  console.log(`${COLORS.cyan}Starting Discord Bot...${COLORS.reset}\n`)
  
  // var setup
  startTime = Date.now();
  isRunning = true;
  renderDisplay.asciiPrinted = false;
  
  botProcess = spawn('node', [CONFIG.botFile], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname,
    env: process.env,
  });
  
  // to handle bot stdout
  botProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => addLogLine(line));
  });
  
  // same thing but stderr
  botProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => addLogLine(`[STDERR] ${line}`));
  });
  
  // handle process exti
  botProcess.on('close', (code) => {
    console.log(`${COLORS.red}Bot exited with code: ${code}${COLORS.reset}`);
    isRunning = false;
    startTime = null;
    
    if (displayInterval) clearInterval(displayInterval);
    
    console.log(`\n${COLORS.yellow}Bot has stopped.${COLORS.reset}`);
    console.log(`${COLORS.gray}Type 'start' to restart, or 'exit' to quit.${COLORS.reset}\n`);
  });
  
  // display update loop
  setTimeout(() => {
    clearScreen();
    renderDisplay(true); // force render
  }, 50);
}

let clientCommandsCount = null;

function addLogLine(line) {
  if (!line) return;
  
  const timestamp = new Date().toLocaleTimeString();
  CONFIG.logBuffer.push(`[${timestamp}] ${line}`);
  
  // trim buffer if it gets too big ilcbiceibtigf
  if (CONFIG.logBuffer.length > CONFIG.maxLogLines) {
    CONFIG.logBuffer.shift();
  }
  
  // throttled render
  setTimeout(() => renderDisplay(), 0);
}

// to actually send to the bot process
function sendToBot(command, data = {}) {
  if (!botProcess || !botProcess.connected) {
    console.log(`${COLORS.red}✗ Bot is not connected or not running${COLORS.reset}`)
  }
  
  botProcess.send({ type: command, ...data });
  addLogLine(`[IPC] Sent ${command} to bot`);
}

function handleInput(input) {
  const trimmed = input.trim().toLowerCase();
  
  switch (trimmed) {
    case 'exit':
    case 'quit':
      if (botProcess && botProcess.pid) {
        botProcess.kill('SIGTERM');
      }
      process.exit(0);
      
    case 'start':
      if (!isRunning) {
        startBot();
      } else {
        console.log(`${COLORS.yellow}Bot is already running${COLORS.reset}`);
      }
      break;
    
    case 'stop':
      if (botProcess && botProcess.pid) {
        botProcess.kill('SIGTERM');
      }
      break;
    
    case 'restart':
       if (botProcess && botProcess.pid) {
        botProcess.kill('SIGTERM');
      }
      setTimeout(startBot, 500);
      break;
    
     case 'reload':
      sendToBot('RELOAD_COMMANDS');
      break;
    
    case 'ping':
      sendToBot('PING');
      break;
    
    case 'clear':
      clearScreen();
      renderDisplay.asciiPrinted = false;
      break;
    
    case 'help':
      console.log(`\n${COLORS.cyan}=== COMMANDS ===${COLORS.reset}`);
      console.log(`${COLORS.white}start   ${COLORS.gray}- Start the bot`);
      console.log(`${COLORS.white}stop    ${COLORS.gray}- Stop the bot`);
      console.log(`${COLORS.white}restart ${COLORS.gray}- Restart the bot`);
      console.log(`${COLORS.white}reload  ${COLORS.gray}- Reload commands via IPC`);
      console.log(`${COLORS.white}ping    ${COLORS.gray}- Ping bot via IPC`);
      console.log(`${COLORS.white}clear   ${COLORS.gray}- Clear screen`);
      console.log(`${COLORS.white}help    ${COLORS.gray}- Show this help`);
      console.log(`${COLORS.white}exit    ${COLORS.gray}- Exit launcher${COLORS.reset}\n`);
      break;
    
    default:
      if (trimmed) {
        console.log(`${COLORS.yellow}Unknown command: ${input}${COLORS.reset}`);
        console.log(`${COLORS.gray}Type 'help' for available commands.${COLORS.reset}`);
      }
  }
}

// readline interface
function initReadline() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
    terminal: true, // fix????
  });
  
  // fixxed ✌️
  rl.setPrompt(`${COLORS.green}➜${COLORS.reset} `);
  
  rl.on('line', (line) => {
    handleInput(line);
    rl.prompt(false);
  });
  
  // to allow quitting with ctrl c
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    if (botProcess && botProcess.pid) {
      botProcess.kill('SIGTERM');
    }
    process.exit(0);
  });
}

// main entry point
function main() {
  initReadline();
  
  startBot();
}

// 🥀
main();