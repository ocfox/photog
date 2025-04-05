// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: {
        PHOTOS: R2Bucket;
        ADMIN_IP_LIST: string;
      };
      cf: CfProperties;
      ctx: ExecutionContext;
    }
  }
}

export {};
