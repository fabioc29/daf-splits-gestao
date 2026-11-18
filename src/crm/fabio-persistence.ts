import {
  initializeState,
  newIdentities,
  saveState,
  StateConflict,
  type StateClient,
} from "./state-persistence";

export type Snapshot = {
  revision: string;
  data: any;
  identitiesReady: boolean;
};
export type CatalogBuilder = (
  persisted: any,
  signal?: AbortSignal,
) => Promise<unknown[]>;
export type Publication = {
  status: "published" | "stale" | "error";
  data?: any;
  error?: any;
};

/**
 * Serializa as gravações CAS do Dashboard e publica somente a projeção pública
 * do catálogo depois que o estado administrativo foi confirmado no banco.
 * Uma falha de catálogo nunca desfaz nem invalida a gravação da gestão.
 */
export class FabioStateWriter {
  private queue: Promise<unknown> = Promise.resolve();
  private stopped = false;
  blocked = false;
  pending = 0;

  constructor(
    private client: StateClient,
    public snapshot: Snapshot,
    private catalog: CatalogBuilder,
    private fallback?: (persisted: any) => unknown[],
    private imageDeadlineMs = 5000,
  ) {}

  static async open(
    client: StateClient,
    catalog: CatalogBuilder,
    fallback?: (persisted: any) => unknown[],
  ) {
    return new FabioStateWriter(
      client,
      await initializeState(client),
      catalog,
      fallback,
    );
  }

  dispose() {
    this.stopped = true;
  }

  async publish(snapshot: Snapshot = this.snapshot): Promise<Publication> {
    try {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let items: unknown[];
      try {
        items = await Promise.race([
          this.catalog(snapshot.data, controller.signal),
          new Promise<unknown[]>((resolve, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              try {
                if (this.fallback) resolve(this.fallback(snapshot.data));
                else reject(Error("CATALOG_IMAGE_TIMEOUT"));
              } catch (error) {
                reject(error);
              }
            }, this.imageDeadlineMs);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
        controller.abort();
      }

      if (this.stopped) throw Error("STATE_WRITER_CLOSED");
      const { data, error } = await this.client.rpc("daf_publish_catalog", {
        p_expected_revision: snapshot.revision,
        p_items: items,
      });
      if (error) {
        return {
          status:
            error.code === "40001" ||
            String(error.message || "").includes("REVISION_CONFLICT")
              ? "stale"
              : "error",
          error,
        };
      }
      if (
        !data ||
        data.revision !== snapshot.revision ||
        data.published !== true
      ) {
        throw Error("INVALID_CATALOG_ACK");
      }
      return { status: "published", data };
    } catch (error) {
      return { status: "error", error };
    }
  }

  save(draft: any) {
    const payload = structuredClone(draft);
    this.pending += 1;
    const task = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (this.stopped) throw Error("STATE_WRITER_CLOSED");
        if (this.blocked) throw new StateConflict();
        if (!this.snapshot.identitiesReady) {
          throw Error("IDENTITIES_ADOPTION_REQUIRED");
        }

        let saved;
        try {
          saved = await saveState(
            this.client,
            this.snapshot.revision,
            newIdentities(payload, this.snapshot.data),
          );
        } catch (error) {
          this.blocked = true;
          throw error;
        }

        if (!saved.data || typeof saved.data !== "object") {
          this.blocked = true;
          throw Error("INVALID_PERSISTED_STATE");
        }

        this.snapshot = { ...saved, identitiesReady: true };

        // O catálogo é uma projeção pública, publicada depois do commit da gestão.
        // A revisão no RPC impede que uma publicação atrasada sobrescreva dados novos.
        const publication = this.publish(this.snapshot);
        return { saved, publication };
      })
      .finally(() => {
        this.pending -= 1;
      });

    this.queue = task;
    return task;
  }
}
