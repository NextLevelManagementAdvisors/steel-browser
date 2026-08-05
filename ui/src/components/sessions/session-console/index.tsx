import { Tabs, TabsTrigger, TabsList } from "@/components/ui/tabs";
import { useState } from "react";
import SessionDetails from "./session-details";
import SessionLogs from "./session-logs";
import SessionDevTools from "./session-devtools";
import SessionVault from "./session-vault";

interface SessionConsoleProps {
  id: string | null;
}

export default function SessionConsole({ id }: SessionConsoleProps) {
  const [activeTab, setActiveTab] = useState<
    "details" | "logs" | "dev-tools" | "vault"
  >("details");

  const tabs: {
    value: "details" | "logs" | "dev-tools" | "vault";
    label: string;
  }[] = [
    { value: "details", label: "Details" },
    { value: "logs", label: "Logs" },
    { value: "dev-tools", label: "Dev Tools" },
    { value: "vault", label: "Vault" },
  ];

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-row justify-between items-center bg-[var(--gray-3)] p-2">
        <Tabs defaultValue="details">
          <TabsList className="bg-transparent">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`!bg-transparent !box-shadow-none rounded-none p-4 ${
                  activeTab === tab.value
                    ? "border-b-2 border-b-[var(--gray-11)]"
                    : ""
                }`}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "details" && <SessionDetails id={id} />}
      {activeTab === "logs" && <SessionLogs id={id!} />}
      {activeTab === "dev-tools" && <SessionDevTools />}
      {activeTab === "vault" && <SessionVault />}
    </div>
  );
}
