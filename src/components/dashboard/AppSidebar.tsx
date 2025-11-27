import { Database, FolderOpen, Upload } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarTrigger className="m-2" />
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Datengrundlage - Single Menu Item */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSectionChange("data-foundation")}
                isActive={activeSection === "data-foundation"}
                className="text-primary text-base py-3"
              >
                <Database className="h-5 w-5" />
                {open && <span>Datengrundlage</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Meine Vorgänge */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSectionChange("processes")}
                isActive={activeSection === "processes"}
                className="text-primary text-base py-3"
              >
                <FolderOpen className="h-5 w-5" />
                {open && <span>Meine Vorgänge</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Neuer Vorgang */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSectionChange("new-process")}
                isActive={activeSection === "new-process"}
                className="text-primary text-base py-3"
              >
                <Upload className="h-5 w-5" />
                {open && <span>Neuer Vorgang</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}