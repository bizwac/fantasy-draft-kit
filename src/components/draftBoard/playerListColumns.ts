// Shared between PlayerRow and PlayerListHeader so header labels always
// line up with the data underneath — every column here reserves its
// width unconditionally in both places, rather than only appearing when
// a given row happens to have that value (which is what silently drifted
// columns out of alignment before).
export const COL = {
  pos: "w-8 sm:w-9",
  injury: "w-6 sm:w-8",
  adp: "w-11 sm:w-14",
  bye: "w-8 sm:w-10",
  rookie: "w-5",
  team: "w-12",
  tier: "w-8",
  value: "w-12",
  draftedBy: "w-24"
};
