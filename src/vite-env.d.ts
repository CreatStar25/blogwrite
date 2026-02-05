/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOUBAO_API_KEY: "6269d2c0-70d7-4856-819c-c329396de7bd"
  readonly VITE_DOUBAO_MODEL?: "doubao-seed-1-6-251015"
  readonly VITE_DOUBAO_IMG_MODEL?: "doubao-seedream-4-0-250828"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
