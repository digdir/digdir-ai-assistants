import React, { useMemo, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useChannels } from "../hooks/useChannels";
import { useUsers } from "../hooks/useUsers";
import { useConversationMetrics } from "../hooks/useConversationMetrics";

type TimePeriod = "daily" | "weekly" | "monthly";
type GroupBy = "channel" | "user" | "channel_user";

interface DashboardRow {
  period: string;
  group: string;
  count: number;
}

const toDateLabel = (date: Date): string => date.toISOString().split("T")[0];

const getStartOfIsoWeek = (date: Date): Date => {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate;
};

const getPeriodKey = (date: Date, period: TimePeriod): string => {
  if (period === "daily") {
    return toDateLabel(date);
  }

  if (period === "weekly") {
    return toDateLabel(getStartOfIsoWeek(date));
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

interface Props {
  selectedTeam: string;
}

const ConversationsDashboard: React.FC<Props> = ({ selectedTeam }) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");
  const [groupBy, setGroupBy] = useState<GroupBy>("channel");
  const [lookbackDays, setLookbackDays] = useState<number>(90);
  const { data: channels = [] } = useChannels({ selectedTeam });
  const { data: users = [] } = useUsers({ selectedTeam });
  const {
    data: rows = [],
    isLoading,
    error,
  } = useConversationMetrics({
    selectedTeam,
    lookbackDays,
  });

  const channelNameById = useMemo(
    () =>
      new Map(channels.map((channel) => [channel.channel_id, channel.name])),
    [channels],
  );

  const userNameById = useMemo(
    () => new Map(users.map((user) => [user.user_id, user.name])),
    [users],
  );

  const aggregatedRows = useMemo<DashboardRow[]>(() => {
    const counter = new Map<string, DashboardRow>();

    for (const row of rows) {
      const date = new Date(row.ts_date * 1000);
      const period = getPeriodKey(date, timePeriod);
      const channelName = channelNameById.get(row.channel_id) || row.channel_id;
      const userName = userNameById.get(row.user_id) || row.user_id;

      let group = channelName;
      if (groupBy === "user") {
        group = userName;
      }
      if (groupBy === "channel_user") {
        group = `${channelName} / ${userName}`;
      }

      const key = `${period}::${group}`;
      const existing = counter.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counter.set(key, { period, group, count: 1 });
      }
    }

    return Array.from(counter.values()).sort((a, b) => {
      if (a.period !== b.period) {
        return b.period.localeCompare(a.period);
      }
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.group.localeCompare(b.group);
    });
  }, [rows, timePeriod, groupBy, channelNameById, userNameById]);

  if (!selectedTeam) {
    return (
      <Typography sx={{ p: 2 }}>Select a team to view dashboard.</Typography>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Conversation Dashboard
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="dashboard-period-label">Period</InputLabel>
          <Select
            labelId="dashboard-period-label"
            value={timePeriod}
            label="Period"
            onChange={(event) =>
              setTimePeriod(event.target.value as TimePeriod)
            }
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-group-label">Group By</InputLabel>
          <Select
            labelId="dashboard-group-label"
            value={groupBy}
            label="Group By"
            onChange={(event) => setGroupBy(event.target.value as GroupBy)}
          >
            <MenuItem value="channel">Channel</MenuItem>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="channel_user">Channel + User</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="dashboard-lookback-label">Date Range</InputLabel>
          <Select
            labelId="dashboard-lookback-label"
            value={lookbackDays}
            label="Date Range"
            onChange={(event) => setLookbackDays(Number(event.target.value))}
          >
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
            <MenuItem value={365}>Last 12 months</MenuItem>
            <MenuItem value={0}>All time</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Typography variant="body2" sx={{ mb: 1 }}>
        Total conversations: {rows.length}
      </Typography>

      {isLoading && <Typography>Loading dashboard data...</Typography>}
      {error && (
        <Typography color="error">
          Failed to load dashboard: {error.message}
        </Typography>
      )}

      {!isLoading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Group</TableCell>
                <TableCell align="right">Conversations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregatedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No conversations found.</TableCell>
                </TableRow>
              )}
              {aggregatedRows.map((row) => (
                <TableRow key={`${row.period}-${row.group}`}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>{row.group}</TableCell>
                  <TableCell align="right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ConversationsDashboard;
