/*
 * Copyright (c) 2024 Šimon Sedlák snipeit.io All rights reserved.
 *
 * Licensed under the GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007 (the "License");
 * You may not use this file except in compliance with the License.
 *
 * You may obtain a copy of the License at
 * https://www.gnu.org/licenses/gpl-3.0.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */


import {CaptchaSolvingService} from "../services/CaptchaSolving.service";

export class CaptchaManager {

    private captchaSolvingService: CaptchaSolvingService;

    private captchaQueue: Array<{ taskId: string, solution: string | null, timestamp: number }> = [];

    private readonly maxCaptchaAge: number = 120000;
    private readonly maxConcurrentCaptchaTasks: number = 3;

    constructor() {
        this.captchaSolvingService = new CaptchaSolvingService();

        // TODO: test and check any unexpected behaviour eg overlapping executions
        // call this first, as soon as we start a new client so the captcha is ready
        this.maintainCaptchaQueue();

        // then set interval for calling it every 1.8 minutes
        setInterval(() => this.maintainCaptchaQueue(), 108000);
    }

    async maintainCaptchaQueue(): Promise<void> {
        this.cleanupExpiredTokens();

        const pendingTasks = this.captchaQueue.filter(task => !task.solution).length;
        const tasksToBeAdded = this.maxConcurrentCaptchaTasks - pendingTasks;

        for (let i = 0; i < tasksToBeAdded; i++) {
            await this.addCaptchaTask();
        }

        this.resolveCaptchaTasks();
    }

    private async addCaptchaTask(): Promise<void> {

        if (this.captchaQueue.length >= this.maxConcurrentCaptchaTasks)
            return;

        const taskId = await this.captchaSolvingService.createTask();

        if (taskId)
            this.captchaQueue.push({ taskId, solution: null, timestamp: Date.now() });

    }

    async resolveCaptchaTasks(): Promise<void> {


        for (const task of this.captchaQueue) {
            if (!task.solution) {
                try {
                    const solution: string = await this.pollForResult(task.taskId, 100, Date.now(), 1000);

                    if (solution)
                        task.solution = solution;


                } catch {

                }
            }
        }

    }

    private cleanupExpiredTokens(): void {
        const currentTime: number = Date.now();

        this.captchaQueue = this.captchaQueue.filter(task => (task.solution && currentTime - task.timestamp < this.maxCaptchaAge) || !task.solution);
    }

    async getCaptchaSolution(): Promise<string | null> {
        const retryLimit = 3;
        let attempts = 0;

        while (attempts < retryLimit) {
            const validToken = this.captchaQueue.find(task => task.solution);
            if (validToken) {
                this.captchaQueue = this.captchaQueue.filter(task => task !== validToken);
                this.regenerateCaptchaTask().catch(error => console.error('Error regenerating captcha task:', error));
                return validToken.solution;
            } else {
                await this.regenerateCaptchaTask();
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw new Error('No valid captcha available after retries.');
    }

    private async regenerateCaptchaTask(): Promise<void> {
        if (this.captchaQueue.length < this.maxConcurrentCaptchaTasks) {
            try {
                const taskId = await this.captchaSolvingService.createTask();
                if (taskId) {
                    this.captchaQueue.push({ taskId, solution: null, timestamp: Date.now() });
                }
            } catch (error) {
                console.error('Error regenerating captcha task:', error);
            }
        }
    }


    async pollForResult(taskId: string, currentDelay: number, startTime: number, maxDelay: number): Promise<string> {
        let attempt = 0;
        const maxAttempts = 10;

        while (Date.now() - startTime < maxDelay && attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, currentDelay));

            try {
                return await this.captchaSolvingService.getTaskResult(taskId);
            } catch (error) {
                attempt++;
                currentDelay *= 2; // Exponential backoff
            }
        }

        throw new Error('Captcha solve timeout or max attempts reached');
    }

}