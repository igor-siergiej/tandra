import type { ListResponse } from '@tandra/types';
import { Check, Edit2, ShoppingCart, X } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { AvatarStack } from '../../ui/avatar-stack';

interface ListItemProps {
    list: ListResponse;
    isOwner: boolean;
    currentUserId: string;
    isEditing: boolean;
    editValue: string;
    onEditChange: (value: string) => void;
    onEditStart: () => void;
    onEditSave: () => void;
    onEditCancel: () => void;
    onDelete: () => void;
    onNavigate: () => void;
}

export const ListItem = ({
    list,
    isOwner,
    currentUserId,
    isEditing,
    editValue,
    onEditChange,
    onEditStart,
    onEditSave,
    onEditCancel,
    onDelete,
    onNavigate,
}: ListItemProps) => (
    <Card className="mb-2 transition-all duration-200 bg-background hover:bg-accent/50 py-0">
        <CardContent className="flex items-center justify-between p-0.5 min-h-12">
            <div className="flex-1">
                {isEditing ? (
                    <div className="flex items-center space-x-2 px-3">
                        <Input
                            purpose="name"
                            value={editValue}
                            onChange={(e) => onEditChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onEditSave();
                                } else if (e.key === 'Escape') {
                                    onEditCancel();
                                }
                            }}
                            className="flex-1"
                            autoFocus
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEditSave}
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                        >
                            <Check size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onEditCancel}
                            className="h-8 w-8 text-gray-500 hover:bg-gray-50"
                        >
                            <X size={16} />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-left text-base font-medium hover:bg-transparent"
                        onClick={onNavigate}
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>{list.title}</span>
                            <AvatarStack users={list.users.filter((user) => user.id !== currentUserId)} />
                        </div>
                    </Button>
                )}
            </div>

            <div className="flex items-center">
                {!isEditing && isOwner && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onEditStart}
                        className="h-12 w-12 hover:bg-blue-50 hover:text-blue-600"
                    >
                        <Edit2 size={20} strokeWidth={1.75} />
                    </Button>
                )}
                {isOwner && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                        className="h-12 w-12 hover:bg-destructive/10 hover:text-destructive"
                        disabled={isEditing}
                    >
                        <X size={24} strokeWidth={1.75} />
                    </Button>
                )}
            </div>
        </CardContent>
    </Card>
);
