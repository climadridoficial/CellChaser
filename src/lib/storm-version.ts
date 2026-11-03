// Central cache version: reprocess observations when saved evidence changes.
export const STORM_VERSION = 5;
// Advisory-only upgrade: version 4 trajectories/intensities remain compatible during rollout.
export const STORM_READ_VERSIONS = [STORM_VERSION, 4];