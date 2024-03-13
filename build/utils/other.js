import { GENESIS_TIMESTAMP } from '../config.js';
import * as fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
export function readFile(relativeFilePath) {
    try {
        const currentDir = path.dirname(fileURLToPath(new URL(import.meta.url)));
        const filePath = path.join(currentDir, relativeFilePath);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return fileContent.split('\n').map(line => line.trim()).filter(line => line !== '');
    }
    catch (error) {
        console.error(`${getCurrentTime()} error reading the file: ${error.message}`);
        return [];
    }
}
function formatTimeLeft(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}
export function until5SecLeft(targetTimestamp) {
    return new Promise((resolve) => {
        let intervalId;
        function _check() {
            const now = Date.now();
            const timeLeft = targetTimestamp - now;
            const genTime = new Date(GENESIS_TIMESTAMP);
            console.log(`${getCurrentTime()} genesis time is in the future. sleeping until then... ${genTime.toLocaleDateString()} ${genTime.toLocaleTimeString()} | ${formatTimeLeft(timeLeft)} left.`);
            if (timeLeft <= 5 * 1000) {
                clearInterval(intervalId);
                resolve();
                return;
            }
            if (timeLeft > 2 * 60 * 1000) {
                clearInterval(intervalId);
                intervalId = setInterval(_check, 60 * 1000);
            }
            else if (timeLeft > 60 * 1000) {
                clearInterval(intervalId);
                intervalId = setInterval(_check, 5 * 1000);
            }
            else if (timeLeft > 15 * 1000) {
                clearInterval(intervalId);
                intervalId = setInterval(_check, 1000);
            }
        }
        _check();
    });
}
export function sleep(ms, log = true) {
    log && console.log(`${getCurrentTime()} sleep ${Math.floor(ms / 1000)} sec.`);
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function identifyInput(input) {
    const privateKeyRegex = /^[0-9a-fA-F]{64}$/;
    if (privateKeyRegex.test(input)) {
        return "private_key";
    }
    else {
        return "mnemonic_phrase";
    }
}
export function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    return `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
}
