"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    socket = io(socketUrl, {
      autoConnect: false,
    });
  }
  return socket;
}

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    const socket = getSocket();
    if (!socket) return;

    socketRef.current = socket;

    // Connect and authenticate
    socket.connect();
    socket.emit("auth", {
      userId: session.user.id,
      userName: `${session.user.firstName} ${session.user.lastName}`,
    });

    return () => {
      // Don't disconnect on cleanup to maintain connection across pages
    };
  }, [session]);

  const joinOrder = useCallback((orderId: string) => {
    socketRef.current?.emit("join:order", orderId);
  }, []);

  const leaveOrder = useCallback((orderId: string) => {
    socketRef.current?.emit("leave:order", orderId);
  }, []);

  const startTyping = useCallback((orderId: string) => {
    socketRef.current?.emit("typing:start", { orderId });
  }, []);

  const stopTyping = useCallback((orderId: string) => {
    socketRef.current?.emit("typing:stop", { orderId });
  }, []);

  const onNewMessage = useCallback((callback: (message: unknown) => void) => {
    socketRef.current?.on("message:new", callback);
    return () => {
      socketRef.current?.off("message:new", callback);
    };
  }, []);

  const onOrderUpdated = useCallback((callback: (update: unknown) => void) => {
    socketRef.current?.on("order:updated", callback);
    return () => {
      socketRef.current?.off("order:updated", callback);
    };
  }, []);

  const onTypingUpdate = useCallback(
    (callback: (data: { userId: string; userName: string; isTyping: boolean }) => void) => {
      socketRef.current?.on("typing:update", callback);
      return () => {
        socketRef.current?.off("typing:update", callback);
      };
    },
    []
  );

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    joinOrder,
    leaveOrder,
    startTyping,
    stopTyping,
    onNewMessage,
    onOrderUpdated,
    onTypingUpdate,
  };
}
