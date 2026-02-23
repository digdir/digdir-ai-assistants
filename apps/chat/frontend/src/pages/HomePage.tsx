import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { ChunksSidebar } from "@/components/ChunksSidebar";
import { useUIStore } from "@/stores/ui";

export function HomePage() {
  const { rightSidebarOpen, activeChunks } = useUIStore();

  return (
    <div className="flex h-full">
      <Sidebar />
      <ChatArea />
      {rightSidebarOpen && <ChunksSidebar chunks={activeChunks} />}
    </div>
  );
}
