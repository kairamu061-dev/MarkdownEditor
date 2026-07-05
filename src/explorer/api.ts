import { invoke } from "@tauri-apps/api/core";

export interface TreeNode {
  name: string;
  /** ヴォールト相対パス（区切りは '/'） */
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

export interface VaultInfo {
  name: string;
  tree: TreeNode[];
}

export const pickVault = () => invoke<VaultInfo | null>("pick_vault");
export const initialVault = () => invoke<VaultInfo | null>("initial_vault");
export const listTree = () => invoke<TreeNode[]>("list_tree");
export const readNote = (relPath: string) =>
  invoke<string>("read_note", { relPath });
export const writeNote = (relPath: string, content: string) =>
  invoke<void>("write_note", { relPath, content });
export const createNote = (relPath: string) =>
  invoke<void>("create_note", { relPath });
export const renamePath = (from: string, to: string) =>
  invoke<void>("rename_path", { from, to });
export const deletePath = (relPath: string) =>
  invoke<void>("delete_path", { relPath });
