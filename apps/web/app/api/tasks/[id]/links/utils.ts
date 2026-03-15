import { parseJsonObject, type ResourceLink } from "@clawops/core";

export type SerializedResourceLink = Omit<ResourceLink, "meta"> & { meta: Record<string, unknown> | null };

export function serializeLink(link: ResourceLink): SerializedResourceLink {
  return {
    ...link,
    meta: link.meta ? parseJsonObject(link.meta) : null,
  };
}
