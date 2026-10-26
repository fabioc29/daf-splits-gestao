import { initializeState, newIdentities, saveState, StateConflict, type StateClient } from "./state-persistence";

export type Snapshot = { revision: string; data: any; identitiesReady: boolean };

/** Serializes acknowledged CAS writes without any public catalog publishing. */
export class FabioStateWriter {
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  blocked = false;
  pending = 0;

  constructor(private client: StateClient, public snapshot: Snapshot) {}

  static async open(client: StateClient) {
    return new FabioStateWriter(client, await initializeState(client));
  }

  dispose() { this.stopped = true; }

  save(draft: any) {
    const payload = structuredClone(draft);
    this.pending++;
    const task = this.queue.catch(() => undefined).then(async () => {
      if (this.stopped) throw Error("STATE_WRITER_CLOSED");
      if (this.blocked) throw new StateConflict();
      if (!this.snapshot.identitiesReady) throw Error("IDENTITIES_ADOPTION_REQUIRED");
      let saved;
      try {
        saved = await saveState(this.client, this.snapshot.revision, newIdentities(payload, this.snapshot.data));
      } catch (error) {
        this.blocked = true;
        throw error;
      }
      if (!saved.data || typeof saved.data !== "object") {
        this.blocked = true;
        throw Error("INVALID_PERSISTED_STATE");
      }
      this.snapshot = { ...saved, identitiesReady: true };
      return { saved };
    }).finally(() => { this.pending--; });
    this.queue = task;
    return task;
  }
}
