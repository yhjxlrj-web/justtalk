export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          status_message: string | null;
          last_seen_at: string | null;
          show_last_seen: boolean;
          country: string | null;
          preferred_language: string | null;
          avatar_url: string | null;
          profile_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          status_message?: string | null;
          last_seen_at?: string | null;
          show_last_seen?: boolean;
          country?: string | null;
          preferred_language?: string | null;
          avatar_url?: string | null;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          status_message?: string | null;
          last_seen_at?: string | null;
          show_last_seen?: boolean;
          country?: string | null;
          preferred_language?: string | null;
          avatar_url?: string | null;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "rejected" | "blocked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: "pending" | "accepted" | "rejected" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: "pending" | "accepted" | "rejected" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_user_id: string;
          blocked_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_user_id: string;
          blocked_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_user_id?: string;
          blocked_user_id?: string;
          created_at?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          chat_type: "direct" | "group";
          title: string | null;
          avatar_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chat_type?: "direct" | "group";
          title?: string | null;
          avatar_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chat_type?: "direct" | "group";
          title?: string | null;
          avatar_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_participants: {
        Row: {
          id: string;
          chat_id: string;
          user_id: string;
          joined_at: string;
          last_seen_at: string | null;
          last_read_message_id: string | null;
          is_muted: boolean;
          preferred_language_snapshot: string | null;
          display_name_snapshot: string | null;
          email_snapshot: string | null;
          avatar_url_snapshot: string | null;
        };
        Insert: {
          id?: string;
          chat_id: string;
          user_id: string;
          joined_at?: string;
          last_seen_at?: string | null;
          last_read_message_id?: string | null;
          is_muted?: boolean;
          preferred_language_snapshot?: string | null;
          display_name_snapshot?: string | null;
          email_snapshot?: string | null;
          avatar_url_snapshot?: string | null;
        };
        Update: {
          id?: string;
          chat_id?: string;
          user_id?: string;
          joined_at?: string;
          last_seen_at?: string | null;
          last_read_message_id?: string | null;
          is_muted?: boolean;
          preferred_language_snapshot?: string | null;
          display_name_snapshot?: string | null;
          email_snapshot?: string | null;
          avatar_url_snapshot?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          original_text: string;
          original_language: string;
          created_at: string;
          client_message_id: string | null;
          message_kind: string;
          attachment_url: string | null;
          attachment_name: string | null;
          attachment_content_type: string | null;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          original_text: string;
          original_language: string;
          created_at?: string;
          client_message_id?: string | null;
          message_kind?: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_content_type?: string | null;
        };
        Update: {
          id?: string;
          chat_id?: string;
          sender_id?: string;
          original_text?: string;
          original_language?: string;
          created_at?: string;
          client_message_id?: string | null;
          message_kind?: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          attachment_content_type?: string | null;
        };
      };
      message_translations: {
        Row: {
          id: string;
          message_id: string;
          target_user_id: string;
          target_language: string;
          translated_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          target_user_id: string;
          target_language: string;
          translated_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          target_user_id?: string;
          target_language?: string;
          translated_text?: string;
          created_at?: string;
        };
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
