export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advance_approvals: {
        Row: {
          advance_id: string
          approver_id: string
          approver_role: string | null
          comments: string | null
          created_at: string
          decision: string
          id: string
          step: number
        }
        Insert: {
          advance_id: string
          approver_id: string
          approver_role?: string | null
          comments?: string | null
          created_at?: string
          decision: string
          id?: string
          step?: number
        }
        Update: {
          advance_id?: string
          approver_id?: string
          approver_role?: string | null
          comments?: string | null
          created_at?: string
          decision?: string
          id?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "advance_approvals_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_installments: {
        Row: {
          advance_id: string
          amount: number
          created_at: string
          due_date: string
          entered_by: string | null
          id: string
          is_manual: boolean
          paid_amount: number | null
          paid_at: string | null
          payment_mode: string | null
          remarks: string | null
          status: string
        }
        Insert: {
          advance_id: string
          amount: number
          created_at?: string
          due_date: string
          entered_by?: string | null
          id?: string
          is_manual?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_mode?: string | null
          remarks?: string | null
          status?: string
        }
        Update: {
          advance_id?: string
          amount?: number
          created_at?: string
          due_date?: string
          entered_by?: string | null
          id?: string
          is_manual?: boolean
          paid_amount?: number | null
          paid_at?: string | null
          payment_mode?: string | null
          remarks?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_installments_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          advance_code: string
          advance_type: Database["public"]["Enums"]["advance_type"]
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disbursed_at: string | null
          id: string
          notes: string | null
          project_id: string | null
          reason: string | null
          recovery_amount: number | null
          recovery_month: string | null
          rejection_reason: string | null
          repayment_terms: string | null
          request_date: string
          status: Database["public"]["Enums"]["advance_status"]
          updated_at: string
          updated_by: string | null
          worker_id: string
        }
        Insert: {
          advance_code?: string
          advance_type?: Database["public"]["Enums"]["advance_type"]
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          reason?: string | null
          recovery_amount?: number | null
          recovery_month?: string | null
          rejection_reason?: string | null
          repayment_terms?: string | null
          request_date?: string
          status?: Database["public"]["Enums"]["advance_status"]
          updated_at?: string
          updated_by?: string | null
          worker_id: string
        }
        Update: {
          advance_code?: string
          advance_type?: Database["public"]["Enums"]["advance_type"]
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          reason?: string | null
          recovery_amount?: number | null
          recovery_month?: string | null
          rejection_reason?: string | null
          repayment_terms?: string | null
          request_date?: string
          status?: Database["public"]["Enums"]["advance_status"]
          updated_at?: string
          updated_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      blacklist_entries: {
        Row: {
          active: boolean
          added_at: string
          added_by: string | null
          category: Database["public"]["Enums"]["blacklist_category"]
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          deleted_at: string | null
          evidence_url: string | null
          id: string
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          previous_designation: string | null
          previous_project: string | null
          reason: string
          worker_id: string
        }
        Insert: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          category?: Database["public"]["Enums"]["blacklist_category"]
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          deleted_at?: string | null
          evidence_url?: string | null
          id?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          previous_designation?: string | null
          previous_project?: string | null
          reason: string
          worker_id: string
        }
        Update: {
          active?: boolean
          added_at?: string
          added_by?: string | null
          category?: Database["public"]["Enums"]["blacklist_category"]
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          deleted_at?: string | null
          evidence_url?: string | null
          id?: string
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          previous_designation?: string | null
          previous_project?: string | null
          reason?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          level: number | null
          name: string
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          level?: number | null
          name: string
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          level?: number | null
          name?: string
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designations_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          active: boolean
          category: string
          code: string
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          doc_number: string | null
          document_type: string
          entity_id: string
          entity_type: string
          file_path: string
          generated_by: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          size_bytes: number | null
          title: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          doc_number?: string | null
          document_type: string
          entity_id: string
          entity_type: string
          file_path: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          size_bytes?: number | null
          title: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          doc_number?: string | null
          document_type?: string
          entity_id?: string
          entity_type?: string
          file_path?: string
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          size_bytes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget: number | null
          client_name: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          location: string | null
          manager_id: string | null
          name: string
          notes: string | null
          start_date: string | null
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget?: number | null
          client_name?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name: string
          notes?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget?: number | null
          client_name?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name?: string
          notes?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          skill_category: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          skill_category?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          skill_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_documents: {
        Row: {
          deleted_at: string | null
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name: string | null
          file_url: string
          id: string
          updated_by: string | null
          uploaded_at: string
          uploaded_by: string | null
          worker_id: string
        }
        Insert: {
          deleted_at?: string | null
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          file_url: string
          id?: string
          updated_by?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          worker_id: string
        }
        Update: {
          deleted_at?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          file_url?: string
          id?: string
          updated_by?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_drafts: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payload: Json
          step: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          step?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          step?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          aadhaar_number: string | null
          account_number: string | null
          address: string | null
          alt_phone: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          created_by: string | null
          date_of_joining: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          designation_id: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_relation: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          father_name: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          ifsc: string | null
          kyc_approved_at: string | null
          kyc_approved_by: string | null
          kyc_id: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          nominee_aadhaar: string | null
          nominee_dob: string | null
          nominee_name: string | null
          nominee_phone: string | null
          nominee_relation: string | null
          notes: string | null
          pan_number: string | null
          phone: string | null
          photo_url: string | null
          pincode: string | null
          project_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["worker_status"]
          trade_id: string | null
          uan_number: string | null
          updated_at: string
          updated_by: string | null
          upi_id: string | null
          worker_code: string
        }
        Insert: {
          aadhaar_number?: string | null
          account_number?: string | null
          address?: string | null
          alt_phone?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_joining?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          designation_id?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_relation?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          father_name?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          ifsc?: string | null
          kyc_approved_at?: string | null
          kyc_approved_by?: string | null
          kyc_id?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          nominee_aadhaar?: string | null
          nominee_dob?: string | null
          nominee_name?: string | null
          nominee_phone?: string | null
          nominee_relation?: string | null
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          project_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          trade_id?: string | null
          uan_number?: string | null
          updated_at?: string
          updated_by?: string | null
          upi_id?: string | null
          worker_code: string
        }
        Update: {
          aadhaar_number?: string | null
          account_number?: string | null
          address?: string | null
          alt_phone?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_joining?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          designation_id?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_relation?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          father_name?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          ifsc?: string | null
          kyc_approved_at?: string | null
          kyc_approved_by?: string | null
          kyc_id?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          nominee_aadhaar?: string | null
          nominee_dob?: string | null
          nominee_name?: string | null
          nominee_phone?: string | null
          nominee_relation?: string | null
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          project_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          trade_id?: string | null
          uan_number?: string | null
          updated_at?: string
          updated_by?: string | null
          upi_id?: string | null
          worker_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_staff: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      advance_status:
        | "pending"
        | "approved"
        | "rejected"
        | "disbursed"
        | "repaid"
      advance_type: "salary" | "emergency" | "festival" | "tool" | "travel"
      app_role:
        | "admin"
        | "hr"
        | "labour_incharge"
        | "viewer"
        | "super_admin"
        | "project_manager"
        | "accounts"
      blacklist_category:
        | "fraud"
        | "absconding"
        | "misconduct"
        | "theft"
        | "other"
        | "violence"
        | "substance_abuse"
        | "safety_violation"
      doc_type: "aadhaar" | "pan" | "bank" | "photo" | "other"
      employment_type: "permanent" | "contract" | "daily_wage" | "temporary"
      gender: "male" | "female" | "other"
      kyc_status: "pending" | "approved" | "rejected"
      worker_status: "active" | "inactive" | "blacklisted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      advance_status: [
        "pending",
        "approved",
        "rejected",
        "disbursed",
        "repaid",
      ],
      advance_type: ["salary", "emergency", "festival", "tool", "travel"],
      app_role: [
        "admin",
        "hr",
        "labour_incharge",
        "viewer",
        "super_admin",
        "project_manager",
        "accounts",
      ],
      blacklist_category: [
        "fraud",
        "absconding",
        "misconduct",
        "theft",
        "other",
        "violence",
        "substance_abuse",
        "safety_violation",
      ],
      doc_type: ["aadhaar", "pan", "bank", "photo", "other"],
      employment_type: ["permanent", "contract", "daily_wage", "temporary"],
      gender: ["male", "female", "other"],
      kyc_status: ["pending", "approved", "rejected"],
      worker_status: ["active", "inactive", "blacklisted"],
    },
  },
} as const
