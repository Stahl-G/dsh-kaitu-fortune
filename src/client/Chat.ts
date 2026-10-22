import { createContext } from "react";
import type { ChatDestination } from "../chat.js";

export const ChatContext = createContext<ChatDestination | undefined>(undefined);
