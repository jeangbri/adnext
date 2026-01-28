export type TriggerType = 'DM_RECEIVED' | 'STORY_REPLY' | 'FEED_COMMENT';
export type ActionType = 'SEND_DM' | 'REPLY_COMMENT';

export interface WorkflowChannelConfig {
    dm?: boolean;
    story?: boolean;
    feed?: boolean;
}

export type MatchMode = 'contains' | 'exact' | 'regex';
