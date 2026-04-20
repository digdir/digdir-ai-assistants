import { Sidebar } from "@/components/Sidebar";
import { AiSearchModule } from "@/components/AiSearchModule";
import { ChatArea } from "@/components/ChatArea";
import { ChunksSidebar } from "@/components/ChunksSidebar";
import { useUIStore } from "@/stores/ui";

export function HomePage() {
  const { rightSidebarOpen, activeChunks } = useUIStore();

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AiSearchModule />
          <ChatArea />
        </div>
        {rightSidebarOpen && <ChunksSidebar chunks={activeChunks} />}
      </div>
    </div>
  );
}
