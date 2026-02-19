import { useQuery } from "@tanstack/react-query";
import supabase from "../supabase/SupabaseClient";

export interface ConversationRow {
  channel_id: string;
  user_id: string;
  ts_date: number;
}

interface UseConversationMetricsProps {
  selectedTeam: string;
  lookbackDays: number;
}

const fetchTeamChannelIds = async (selectedTeam: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("slack_channel")
    .select("channel_id")
    .eq("team_id", selectedTeam);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((channel) => channel.channel_id);
};

export const useConversationMetrics = ({
  selectedTeam,
  lookbackDays,
}: UseConversationMetricsProps) =>
  useQuery<ConversationRow[], Error>({
    queryKey: ["conversation-metrics", selectedTeam, lookbackDays],
    enabled: !!selectedTeam,
    queryFn: async () => {
      const channelIds = await fetchTeamChannelIds(selectedTeam);

      if (!channelIds.length) {
        return [];
      }

      let query = supabase
        .from("slack_message")
        .select("channel_id,user_id,ts_date")
        .in("channel_id", channelIds)
        .eq("thread_ts_date", 0)
        .eq("content_type", "docs_user_query")
        .order("ts_date", { ascending: false });

      if (lookbackDays > 0) {
        const now = Math.floor(Date.now() / 1000);
        const fromTimestamp = now - lookbackDays * 24 * 60 * 60;
        query = query.gte("ts_date", fromTimestamp);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    },
  });
