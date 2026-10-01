export type { Database, Json } from "./database.types";
import type { Database } from "./database.types";

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T];

/** Genre slugs are admin-managed rows in public.genres. */
export type Genre = string;
export type AgeRating = "all" | "16" | "18";
export type StoryStatus = "draft" | "published";
export type PaymentStatus = "created" | "submitted" | "approved" | "rejected" | "expired";
export type ProductKind = "coin_pack" | "subscription" | "story";
