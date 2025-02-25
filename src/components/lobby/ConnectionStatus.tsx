import React from 'react';

interface ConnectionStatusProps {
  isError: boolean;
  errorMessage?: string | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isError, errorMessage }) => {
  if (!isError) return null;

  return (
    <div className="lobby-error">
      <span>{errorMessage || 'Unable to connect to game server'}</span>
    </div>
  );
}; 