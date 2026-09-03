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
      agendamentos: {
        Row: {
          cliente_id: string
          criado_em: string
          descricao: string | null
          fim: string | null
          id: string
          inicio: string | null
          tipo: string | null
          titulo: string | null
          visivel_cliente: boolean
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          descricao?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          tipo?: string | null
          titulo?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          descricao?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          tipo?: string | null
          titulo?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          atualizado_em: string
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action: string
          cliente_id: string | null
          criado_em: string
          id: string
          metadata: Json | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          action: string
          cliente_id?: string | null
          criado_em?: string
          id?: string
          metadata?: Json | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          action?: string
          cliente_id?: string | null
          criado_em?: string
          id?: string
          metadata?: Json | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          atualizado_em: string
          cnpj: string | null
          criado_em: string
          dados_extras: Json | null
          diagnostico: Json | null
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          razao_social: string | null
          status: string
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          dados_extras?: Json | null
          diagnostico?: Json | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          razao_social?: string | null
          status?: string
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          cnpj?: string | null
          criado_em?: string
          dados_extras?: Json | null
          diagnostico?: Json | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          razao_social?: string | null
          status?: string
          telefone?: string | null
        }
        Relationships: []
      }
      conteudos: {
        Row: {
          atualizado_em: string
          cliente_id: string
          criado_em: string
          data_postagem: string | null
          feedback_cliente: string | null
          id: string
          rede: string | null
          roteiro: string | null
          status: string
          tipo: string | null
          titulo: string | null
          url_arquivo: string | null
          url_briefing: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          data_postagem?: string | null
          feedback_cliente?: string | null
          id?: string
          rede?: string | null
          roteiro?: string | null
          status?: string
          tipo?: string | null
          titulo?: string | null
          url_arquivo?: string | null
          url_briefing?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          data_postagem?: string | null
          feedback_cliente?: string | null
          id?: string
          rede?: string | null
          roteiro?: string | null
          status?: string
          tipo?: string | null
          titulo?: string | null
          url_arquivo?: string | null
          url_briefing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_frases_por_faixa: {
        Row: {
          atualizado_em: string
          criado_em: string
          faixa_max: number
          faixa_min: number
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          frase: string
          id: string
          placeholder: boolean
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          faixa_max: number
          faixa_min: number
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          frase: string
          id?: string
          placeholder?: boolean
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          faixa_max?: number
          faixa_min?: number
          fonte?: Database["public"]["Enums"]["fonte_diagnostico"]
          frase?: string
          id?: string
          placeholder?: boolean
        }
        Relationships: []
      }
      diagnostico_questoes: {
        Row: {
          ajuda: string | null
          ativa: boolean
          codigo: string
          criado_em: string
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          id: string
          ordem: number
          pergunta: string
          peso: number
          placeholder: boolean
          tipo: string
        }
        Insert: {
          ajuda?: string | null
          ativa?: boolean
          codigo: string
          criado_em?: string
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          id?: string
          ordem?: number
          pergunta: string
          peso?: number
          placeholder?: boolean
          tipo?: string
        }
        Update: {
          ajuda?: string | null
          ativa?: boolean
          codigo?: string
          criado_em?: string
          fonte?: Database["public"]["Enums"]["fonte_diagnostico"]
          id?: string
          ordem?: number
          pergunta?: string
          peso?: number
          placeholder?: boolean
          tipo?: string
        }
        Relationships: []
      }
      diagnostico_relatorios: {
        Row: {
          cliente_id: string
          gerado_em: string
          gerado_por: string | null
          id: string
          link_expira_em: string | null
          link_token: string | null
          por_fonte: Json
          resumo_executivo: string | null
          score_geral: number | null
        }
        Insert: {
          cliente_id: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          link_expira_em: string | null
          link_token: string | null
          por_fonte?: Json
          resumo_executivo?: string | null
          score_geral?: number | null
        }
        Update: {
          cliente_id?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          link_expira_em?: string | null
          link_token?: string | null
          por_fonte?: Json
          resumo_executivo?: string | null
          score_geral?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_relatorios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_respostas: {
        Row: {
          atualizado_em: string
          cliente_id: string
          criado_em: string
          id: string
          questao_id: string
          respondido_por: string | null
          valor_num: number | null
          valor_texto: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          id?: string
          questao_id: string
          respondido_por?: string | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          id?: string
          questao_id?: string
          respondido_por?: string | null
          valor_num?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_respostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostico_respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "diagnostico_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_scores: {
        Row: {
          atualizado_em: string
          cliente_id: string
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          id: string
          respondidas: number
          score: number | null
          total: number
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          fonte: Database["public"]["Enums"]["fonte_diagnostico"]
          id?: string
          respondidas?: number
          score?: number | null
          total?: number
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          fonte?: Database["public"]["Enums"]["fonte_diagnostico"]
          id?: string
          respondidas?: number
          score?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_scores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          atualizado_em: string
          cliente_id: string
          criado_em: string
          id: string
          resposta_cliente: string | null
          status: string
          tipo: string | null
          titulo: string | null
          url_arquivo: string | null
          url_arquivo_bruto: string | null
          url_arquivo_final: string | null
          url_briefing: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          id?: string
          resposta_cliente?: string | null
          status?: string
          tipo?: string | null
          titulo?: string | null
          url_arquivo?: string | null
          url_arquivo_bruto?: string | null
          url_arquivo_final?: string | null
          url_briefing?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          id?: string
          resposta_cliente?: string | null
          status?: string
          tipo?: string | null
          titulo?: string | null
          url_arquivo?: string | null
          url_arquivo_bruto?: string | null
          url_arquivo_final?: string | null
          url_briefing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          atualizado_em: string
          canal: string | null
          cliente_id: string
          criado_em: string
          email: string | null
          icp: string | null
          id: string
          meta_ad_id: string | null
          meta_ad_name: string | null
          meta_campaign_id: string | null
          meta_campaign_name: string | null
          meta_form_id: string | null
          meta_form_name: string | null
          meta_leadgen_id: string | null
          meta_page_id: string | null
          motivo_perda: string | null
          nome: string | null
          observacoes: string | null
          status: string
          telefone: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          atualizado_em?: string
          canal?: string | null
          cliente_id: string
          criado_em?: string
          email?: string | null
          icp?: string | null
          id?: string
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_form_name?: string | null
          meta_leadgen_id?: string | null
          meta_page_id?: string | null
          motivo_perda?: string | null
          nome?: string | null
          observacoes?: string | null
          status?: string
          telefone?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          atualizado_em?: string
          canal?: string | null
          cliente_id?: string
          criado_em?: string
          email?: string | null
          icp?: string | null
          id?: string
          meta_ad_id?: string | null
          meta_ad_name?: string | null
          meta_campaign_id?: string | null
          meta_campaign_name?: string | null
          meta_form_id?: string | null
          meta_form_name?: string | null
          meta_leadgen_id?: string | null
          meta_page_id?: string | null
          motivo_perda?: string | null
          nome?: string | null
          observacoes?: string | null
          status?: string
          telefone?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      metricas_ads: {
        Row: {
          ad_id: string
          anuncio: string | null
          campanha: string
          cliente_id: string
          cliques: number
          conversoes: number
          cpa: number | null
          cpl: number | null
          criado_em: string
          data: string
          id: string
          impressoes: number
          investimento: number
          leads: number
          nivel: string
          plataforma: string
          roas: number | null
        }
        Insert: {
          ad_id?: string
          anuncio?: string | null
          campanha?: string
          cliente_id: string
          cliques?: number
          conversoes?: number
          cpa?: number | null
          cpl?: number | null
          criado_em?: string
          data: string
          id?: string
          impressoes?: number
          investimento?: number
          leads?: number
          nivel?: string
          plataforma: string
          roas?: number | null
        }
        Update: {
          ad_id?: string
          anuncio?: string | null
          campanha?: string
          cliente_id?: string
          cliques?: number
          conversoes?: number
          cpa?: number | null
          cpl?: number | null
          criado_em?: string
          data?: string
          id?: string
          impressoes?: number
          investimento?: number
          leads?: number
          nivel?: string
          plataforma?: string
          roas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_ads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nurture_jobs: {
        Row: {
          atualizado_em: string
          cliente_id: string
          criado_em: string
          id: string
          kind: string
          last_error: string | null
          last_sent_at: string | null
          lead_id: string
          metadata: Json
          next_run_at: string
          status: string
          step: number
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          id?: string
          kind: string
          last_error?: string | null
          last_sent_at?: string | null
          lead_id: string
          metadata?: Json
          next_run_at?: string
          status?: string
          step?: number
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_sent_at?: string | null
          lead_id?: string
          metadata?: Json
          next_run_at?: string
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "nurture_jobs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurture_jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades_b2b: {
        Row: {
          atualizado_em: string
          cac: number | null
          canal: string | null
          cidade: string | null
          criado_em: string
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          responsavel_id: string | null
          roi: number | null
          status: string
          telefone: string | null
          ticket: number | null
        }
        Insert: {
          atualizado_em?: string
          cac?: number | null
          canal?: string | null
          cidade?: string | null
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          responsavel_id?: string | null
          roi?: number | null
          status?: string
          telefone?: string | null
          ticket?: number | null
        }
        Update: {
          atualizado_em?: string
          cac?: number | null
          canal?: string | null
          cidade?: string | null
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          responsavel_id?: string | null
          roi?: number | null
          status?: string
          telefone?: string | null
          ticket?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_b2b_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_cache: {
        Row: {
          checked_at: string
          exists: boolean
          telefone: string
        }
        Insert: {
          checked_at?: string
          exists: boolean
          telefone: string
        }
        Update: {
          checked_at?: string
          exists?: boolean
          telefone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          criado_em: string
          email: string | null
          id: string
          nome: string | null
          permissoes: string[] | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
          permissoes?: string[] | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          permissoes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_errors: {
        Row: {
          cliente_id: string | null
          criado_em: string
          error: string | null
          id: string
          payload: Json | null
          source: string
        }
        Insert: {
          cliente_id?: string | null
          criado_em?: string
          error?: string | null
          id?: string
          payload?: Json | null
          source: string
        }
        Update: {
          cliente_id?: string | null
          criado_em?: string
          error?: string | null
          id?: string
          payload?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_errors_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          atualizado_em: string
          bot_notes: Json | null
          bot_score: number | null
          cliente_id: string
          closed_at: string | null
          closed_reason: string | null
          contact_name: string | null
          contact_phone: string
          criado_em: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          lead_id: string | null
          origem: string
          owner_state: string | null
          state: string
          step_count: number
        }
        Insert: {
          atualizado_em?: string
          bot_notes?: Json | null
          bot_score?: number | null
          cliente_id: string
          closed_at?: string | null
          closed_reason?: string | null
          contact_name?: string | null
          contact_phone: string
          criado_em?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          origem?: string
          owner_state?: string | null
          state?: string
          step_count?: number
        }
        Update: {
          atualizado_em?: string
          bot_notes?: Json | null
          bot_score?: number | null
          cliente_id?: string
          closed_at?: string | null
          closed_reason?: string | null
          contact_name?: string | null
          contact_phone?: string
          criado_em?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          lead_id?: string | null
          origem?: string
          owner_state?: string | null
          state?: string
          step_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          atualizado_em: string
          cliente_id: string
          criado_em: string
          dados_extras: Json | null
          id: string
          instance_id: string | null
          last_connected_at: string | null
          phone: string | null
          provider: string
          status: string
          token: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          criado_em?: string
          dados_extras?: Json | null
          id?: string
          instance_id?: string | null
          last_connected_at?: string | null
          phone?: string | null
          provider: string
          status?: string
          token?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          criado_em?: string
          dados_extras?: Json | null
          id?: string
          instance_id?: string | null
          last_connected_at?: string | null
          phone?: string | null
          provider?: string
          status?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          cliente_id: string
          conversation_id: string
          delivery_status: string | null
          direction: string
          id: string
          metadata: Json | null
          sender_type: string
          sender_user_id: string | null
          sent_at: string
          zapi_message_id: string | null
        }
        Insert: {
          body: string
          cliente_id: string
          conversation_id: string
          delivery_status?: string | null
          direction: string
          id?: string
          metadata?: Json | null
          sender_type: string
          sender_user_id?: string | null
          sent_at?: string
          zapi_message_id?: string | null
        }
        Update: {
          body?: string
          cliente_id?: string
          conversation_id?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          metadata?: Json | null
          sender_type?: string
          sender_user_id?: string | null
          sent_at?: string
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_diagnostico_score_geral: {
        Row: {
          atualizado_em: string | null
          cliente_id: string | null
          fontes_com_resposta: number | null
          respostas_total: number | null
          score_geral: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_scores_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funil_lead_cliente: {
        Row: {
          cliente_id: string | null
          horas_no_estagio: number | null
          status: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_funil_oportunidades_b2b: {
        Row: {
          horas_no_estagio: number | null
          status: string | null
          ticket_soma: number | null
          total: number | null
        }
        Relationships: []
      }
      vw_kpis_cliente_diario: {
        Row: {
          atendidos: number | null
          cliente_id: string | null
          convertidos: number | null
          cpl: number | null
          data: string | null
          investimento: number | null
          leads_captados: number | null
          leads_qualificados: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_ads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_kpis_pipeline_b2b: {
        Row: {
          em_andamento: number | null
          fechados: number | null
          mrr: number | null
          taxa_fechamento_pct: number | null
          ticket_medio_b2b: number | null
          total_oportunidades: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_cliente:
        | {
            Args: { _cnpj?: string; _email: string; _nome: string }
            Returns: string
          }
        | {
            Args: {
              _cnpj?: string
              _email: string
              _especialidade?: string
              _nome: string
            }
            Returns: string
          }
      admin_delete_cliente: { Args: { _id: string }; Returns: undefined }
      admin_update_cliente: {
        Args: {
          _cnpj?: string
          _email?: string
          _especialidade?: string
          _id: string
          _nome?: string
          _razao_social?: string
          _status?: string
          _telefone?: string
        }
        Returns: undefined
      }
      admin_upsert_profile_role: {
        Args: {
          _cliente_id?: string
          _permissoes?: string[]
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      assert_current_admin: { Args: never; Returns: undefined }
      atualizar_redes_cliente: { Args: { _redes: Json }; Returns: undefined }
      bootstrap_admin: { Args: { _email: string }; Returns: string }
      close_stalled_conversations: { Args: never; Returns: number }
      current_cliente_id: { Args: never; Returns: string }
      get_or_create_conversation: {
        Args: {
          _cliente_id: string
          _nome?: string
          _origem?: string
          _phone: string
        }
        Returns: string
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_ticket_converted: {
        Args: { _lead_id: string; _ticket: number }
        Returns: undefined
      }
      mover_lead_status: {
        Args: { _lead_id: string; _motivo?: string; _novo: string }
        Returns: undefined
      }
      mover_oportunidade_b2b_status: {
        Args: { _id: string; _novo: string }
        Returns: undefined
      }
      recalcular_diagnostico_score: {
        Args: {
          _cliente_id: string
          _fonte: Database["public"]["Enums"]["fonte_diagnostico"]
        }
        Returns: undefined
      }
      responder_conteudo: {
        Args: { _aprovada: boolean; _feedback?: string; _id: string }
        Returns: undefined
      }
      responder_entrega: {
        Args: { _aprovada: boolean; _id: string; _resposta: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor_estrategico"
        | "growth_manager"
        | "social_media"
        | "performance"
        | "atendimento_cs"
        | "financeiro"
        | "cliente"
      fonte_diagnostico:
        | "posicionamento"
        | "presenca_digital"
        | "aquisicao_pacientes"
        | "conversao"
        | "experiencia_paciente"
        | "inteligencia_dados"
        | "escala"
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
      app_role: [
        "admin",
        "gestor_estrategico",
        "growth_manager",
        "social_media",
        "performance",
        "atendimento_cs",
        "financeiro",
        "cliente",
      ],
      fonte_diagnostico: [
        "posicionamento",
        "presenca_digital",
        "aquisicao_pacientes",
        "conversao",
        "experiencia_paciente",
        "inteligencia_dados",
        "escala",
      ],
    },
  },
} as const
