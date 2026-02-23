import React, { useState, useEffect } from "react";
import "./App.css";
import ChatMessageView from "./components/ChatMessageView";
import Layout from "./components/Layout"; // Importing the Layout component
import TopBar from "./components/TopBar"; // Importing the TopBar component
import ConversationsDashboard from "./components/ConversationsDashboard";
import { Box, Tab, Tabs } from "@mui/material";

type AppView = "chat" | "dashboard";

function App() {
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [activeView, setActiveView] = useState<AppView>("dashboard");

  useEffect(() => {
    // Retrieve the last selected team and channel from localStorage
    const storedSelectedTeam = localStorage.getItem("selectedTeam");
    const storedSelectedChannel = localStorage.getItem("selectedChannel");
    if (storedSelectedTeam) {
      setSelectedTeam(storedSelectedTeam);
    }
    if (storedSelectedChannel) {
      setSelectedChannel(storedSelectedChannel);
    }
  }, []);

  const handleTeamChange = (teamId: string) => {
    console.log(`Team changed to: ${teamId}`);
    setSelectedTeam(teamId);
    // Save the selected team to localStorage
    localStorage.setItem("selectedTeam", teamId);
  };

  const handleChannelSelect = (channelId: string) => {
    console.log(`Channel selected: ${channelId}`);
    setSelectedChannel(channelId);
    // Save the selected channel to localStorage
    localStorage.setItem("selectedChannel", channelId);
  };

  const handleViewChange = (_event: React.SyntheticEvent, value: AppView) => {
    if (value) {
      setActiveView(value);
    }
  };

  console.log("App component rendering...");
  return (
    <>
      <TopBar
        selectedTeam={selectedTeam}
        onTeamChange={handleTeamChange}
        selectedChannel={selectedChannel}
        onChannelSelect={handleChannelSelect}
      />
      <Layout
        channels={[]}
        activeChannelId={selectedChannel || null}
        mainContent={
          <Box>
            <Box sx={{ px: 2, pt: 2 }}>
              <Tabs value={activeView} onChange={handleViewChange}>
                <Tab value="dashboard" label="Dashboard" />
                <Tab value="chat" label="Chat" />
              </Tabs>
            </Box>

            {activeView === "dashboard" && (
              <ConversationsDashboard selectedTeam={selectedTeam} />
            )}

            {activeView === "chat" && selectedChannel && (
              <ChatMessageView
                selectedChannel={selectedChannel}
                selectedTeam={selectedTeam}
              />
            )}
          </Box>
        }
        sideContent={<div>{/* Side content if needed */}</div>}
      ></Layout>
    </>
  );
}

export default App;
