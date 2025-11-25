import { FileText, FolderCheck, FolderOpen, Upload } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { open } = useSidebar();

  const isDataSection = activeSection === "baseline" || activeSection === "accepted";

  return (
    <Sidebar collapsible="icon">
      <SidebarTrigger className="m-2" />
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* Datengrundlage - Collapsible */}
            <Collapsible open={isDataSection} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <FolderOpen className="h-4 w-4" />
                    {open && <span>Datengrundlage</span>}
                    {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                  </SidebarMenuButton>
                </CollapsibleTrigger>
              </SidebarMenuItem>
              
              <CollapsibleContent>
                <SidebarMenuButton
                  onClick={() => onSectionChange("baseline")}
                  isActive={activeSection === "baseline"}
                  className="pl-8"
                >
                  <FileText className="h-4 w-4" />
                  {open && <span>Mein Kodex</span>}
                </SidebarMenuButton>
                
                <SidebarMenuButton
                  onClick={() => onSectionChange("accepted")}
                  isActive={activeSection === "accepted"}
                  className="pl-8"
                >
                  <FolderCheck className="h-4 w-4" />
                  {open && <span>Akzeptierte Punkte</span>}
                </SidebarMenuButton>
              </CollapsibleContent>
            </Collapsible>

            {/* Meine Vorgänge */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSectionChange("processes")}
                isActive={activeSection === "processes"}
              >
                <FolderOpen className="h-4 w-4" />
                {open && <span>Meine Vorgänge</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Neuer Vorgang */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSectionChange("new-process")}
                isActive={activeSection === "new-process"}
              >
                <Upload className="h-4 w-4" />
                {open && <span>Neuer Vorgang</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}