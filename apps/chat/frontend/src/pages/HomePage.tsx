import { Sidebar } from "@/components/Sidebar";
import { AiSearchLauncher } from "@/components/AiSearchLauncher";
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
          <div className="flex items-center justify-end border-b border-gray-200 bg-white px-4 py-3">
            <AiSearchLauncher />
          </div>
          <ChatArea />
        </div>
        {rightSidebarOpen && <ChunksSidebar chunks={activeChunks} />}
      </div>
      <AiSearchModule />
    </div>
  );
}
