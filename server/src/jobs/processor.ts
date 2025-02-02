import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { handleJobFactory } from "./job";
import { JobNames } from "./enums";

export class JobProcessor {
  queues: { [key: string]: Queue } = {};
  workers: { [key: string]: Worker } = {};

  connection: Redis;
  io: SocketIOServer;
  handleJob: (job: any) => Promise<void>;

  constructor(connection: Redis, io: SocketIOServer) {
    this.connection = connection;
    this.io = io;
    this.handleJob = handleJobFactory(io);
  }

  async addQueue(listId: string) {
    if (listId in this.queues) {
      return;
    }

    const queue = new Queue(listId, { connection: this.connection });
    /*
      https://docs.bullmq.io/guide/queues/global-concurrency
      https://api.docs.bullmq.io/classes/v5.Queue.html#setGlobalConcurrency
      Maximum number of simultaneous jobs that the workers can handle. For instance, setting this value to 1 ensures 
      that no more than one job is processed at any given time. If this limit is not defined, there will be no 
      restriction on the number of concurrent jobs.
    */
    await queue.setGlobalConcurrency(1);
    this.queues[listId] = queue;
  }

  async addWorker(listId: string) {
    if (listId in this.workers) {
      return;
    }

    this.workers[listId] = new Worker(listId, this.handleJob, {
      connection: this.connection,
    });
  }

  async addJob(listId: string, jobId: string, jobName: JobNames, job: any) {
    await this.addQueue(listId);
    await this.addWorker(listId);
    await this.queues[listId]?.add(jobName, job, { jobId });
  }
}
