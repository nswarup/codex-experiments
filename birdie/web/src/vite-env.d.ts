/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_TARGET?: "artifact";
}

declare module "virtual:corpus-index" {
  const index: {
    id: string;
    title: string;
    category: string;
    hook: string;
    peek: string;
    tags: string[];
    related: string[];
    words: number;
  }[];
  export default index;
}
