import { z } from "zod";

// Every external response is validated before it touches the store
// (spec §7b.2). Fields we don't use are ignored rather than rejected —
// Sleeper's payload has dozens of fields we don't care about.
export const SleeperPlayerRawSchema = z.object({
  player_id: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  fantasy_positions: z.array(z.string()).nullable().optional(),
  injury_status: z.string().nullable().optional(),
  years_exp: z.number().nullable().optional(),
  depth_chart_order: z.number().nullable().optional(),
  depth_chart_position: z.string().nullable().optional(),
  status: z.string().nullable().optional()
});
export type SleeperPlayerRaw = z.infer<typeof SleeperPlayerRawSchema>;

// The dump is a giant object keyed by player_id, not an array.
export const SleeperPlayersResponseSchema = z.record(z.string(), z.unknown());

export const SleeperTrendingEntrySchema = z.object({
  player_id: z.string(),
  count: z.number()
});
export const SleeperTrendingResponseSchema = z.array(SleeperTrendingEntrySchema);

export const FfcAdpPlayerSchema = z.object({
  player_id: z.union([z.string(), z.number()]),
  name: z.string(),
  position: z.string(),
  team: z.string().nullable().optional(),
  bye: z.union([z.string(), z.number()]).nullable().optional(),
  adp: z.union([z.string(), z.number()]),
  adp_formatted: z.string().nullable().optional(),
  stdev: z.union([z.string(), z.number()]).nullable().optional(),
  times_drafted: z.union([z.string(), z.number()]).nullable().optional()
});
export const FfcAdpResponseSchema = z.object({
  status: z.string().optional(),
  players: z.array(FfcAdpPlayerSchema)
});
export type FfcAdpPlayer = z.infer<typeof FfcAdpPlayerSchema>;
