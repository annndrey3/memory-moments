import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Wand2 } from "lucide-react";
import ToolBar from "./ToolBar";
import TextToolBar from "./TextToolBar";
import LineToolBar from "./LineToolBar";
import ImageMaskToolBar from "./ImageMaskToolBar";
import { Separator } from "@/components/ui/separator";

function SidebarContent({ manualSync }) {
  return (
    <>
      <ToolBar manualSync={manualSync} />
      <TextToolBar manualSync={manualSync} />
      <LineToolBar manualSync={manualSync} />
      <ImageMaskToolBar manualSync={manualSync} />
    </>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
        <Wand2 className="h-4 w-4 text-white" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-sidebar-foreground leading-tight">
          Інструменти
        </h2>
        <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
          Designer
        </p>
      </div>
    </div>
  );
}

export function ToolsSidebar({ manualSync }) {
  return (
    <>
      {/* Mobile */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden fixed top-4 left-4 z-40 h-10 w-10 rounded-xl glass shadow-soft"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] sm:w-[340px] bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetHeader className="text-left">
            <SheetTitle className="text-sidebar-foreground">
              <SidebarBrand />
            </SheetTitle>
          </SheetHeader>
          <Separator className="my-4 bg-sidebar-border" />
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="pr-4">
              <SidebarContent manualSync={manualSync} />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-5 border-b border-sidebar-border">
          <SidebarBrand />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 pr-3">
            <SidebarContent manualSync={manualSync} />
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
