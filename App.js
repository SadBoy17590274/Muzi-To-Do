import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  PanResponder,
  useWindowDimensions,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const STORAGE_KEYS = {
  TASKS: '@muzi_tasks_v1',
  THEME: '@muzi_theme_v1',
  WELCOME: '@muzi_welcome_v1',
};

// Safe storage helper
const safeStorage = {
  getItem: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {}
  },
};

// =============================================================================
// Swipeable Task Item:
// - Swipe RIGHT: Delete (freistehendes rotes Mülleimer-Icon)
// - Swipe LEFT: Als erledigt markieren (freistehendes Häkchen)
// - Antippen (onPress): Detail-Fenster öffnen mit allen Bildern/Dateien
// - Gedrückt halten (onLongPress): Aufgabe bearbeiten
// =============================================================================
const SwipeableTask = ({
  item,
  isDark,
  onToggle,
  onDelete,
  onPressTask,
  onLongPressTask,
  windowWidth,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 12 && Math.abs(gesture.dy) < 15;
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 110) {
          // Swipe RIGHT -> Delete
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: windowWidth || 400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDelete(item.id);
          });
        } else if (gesture.dx < -100) {
          // Swipe LEFT -> Mark as completed
          onToggle(item.id);
          Animated.spring(pan.x, {
            toValue: 0,
            friction: 7,
            tension: 55,
            useNativeDriver: true,
          }).start();
        } else {
          // Snap back
          Animated.spring(pan.x, {
            toValue: 0,
            friction: 7,
            tension: 55,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const trashScale = pan.x.interpolate({
    inputRange: [0, 40, 110],
    outputRange: [0.5, 0.9, 1.25],
    extrapolate: 'clamp',
  });
  const trashOpacity = pan.x.interpolate({
    inputRange: [0, 20, 60],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  const completeScale = pan.x.interpolate({
    inputRange: [-110, -40, 0],
    outputRange: [1.25, 0.9, 0.5],
    extrapolate: 'clamp',
  });
  const completeOpacity = pan.x.interpolate({
    inputRange: [-60, -20, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: 'clamp',
  });

  const hasAttachments =
    (item.images && item.images.length > 0) || (item.files && item.files.length > 0);

  return (
    <View style={styles.swipeRowContainer}>
      {/* Freistehendes rotes Mülleimer-Icon (links, beim Nach-Rechts-Wischen) */}
      <View style={styles.trashBackground}>
        <Animated.View style={{ transform: [{ scale: trashScale }], opacity: trashOpacity }}>
          <Feather name="trash-2" size={24} color="#EF4444" />
        </Animated.View>
      </View>

      {/* Freistehendes Häkchen-Icon (rechts, beim Nach-Links-Wischen) */}
      <View style={styles.completeBackground}>
        <Animated.View style={{ transform: [{ scale: completeScale }], opacity: completeOpacity }}>
          <Feather
            name="check-circle"
            size={24}
            color={item.completed ? '#888888' : '#10B981'}
          />
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.taskCard,
          isDark ? styles.cardDark : styles.cardLight,
          { transform: [{ translateX: pan.x }], opacity },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Checkbox */}
        <TouchableOpacity
          onPress={() => onToggle(item.id)}
          style={[
            styles.checkbox,
            item.completed && (isDark ? styles.checkboxCheckedDark : styles.checkboxCheckedLight),
            isDark ? styles.checkboxBorderDark : styles.checkboxBorderLight,
          ]}
          activeOpacity={0.7}
        >
          {item.completed && (
            <Feather name="check" size={14} color={isDark ? '#000000' : '#FFFFFF'} />
          )}
        </TouchableOpacity>

        {/* Task Content: Tap opens details, Long Press edits */}
        <TouchableOpacity
          style={styles.taskTextWrapper}
          onPress={() => onPressTask(item)}
          onLongPress={() => onLongPressTask(item)}
          delayLongPress={400}
          activeOpacity={0.75}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.taskTitle,
                isDark ? styles.textDark : styles.textLight,
                item.completed && (isDark ? styles.taskCompletedDark : styles.taskCompletedLight),
              ]}
              numberOfLines={2}
            >
              {item.text}
            </Text>

            {/* Attachment badges if present */}
            {hasAttachments && (
              <View style={styles.attachmentBadgesRow}>
                {item.images && item.images.length > 0 && (
                  <View style={[styles.miniBadge, isDark ? styles.miniBadgeDark : styles.miniBadgeLight]}>
                    <Feather name="image" size={11} color={isDark ? '#AAAAAA' : '#666666'} />
                    <Text style={[styles.miniBadgeText, isDark ? styles.subtextDark : styles.subtextLight]}>
                      {item.images.length}
                    </Text>
                  </View>
                )}
                {item.files && item.files.length > 0 && (
                  <View style={[styles.miniBadge, isDark ? styles.miniBadgeDark : styles.miniBadgeLight]}>
                    <Feather name="paperclip" size={11} color={isDark ? '#AAAAAA' : '#666666'} />
                    <Text style={[styles.miniBadgeText, isDark ? styles.subtextDark : styles.subtextLight]}>
                      {item.files.length}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Edit hint on long press */}
          <Feather
            name="chevron-right"
            size={16}
            color={isDark ? '#333333' : '#CCCCCC'}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// =============================================================================
// Main App Component
// =============================================================================
export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = windowWidth * 0.8;

  const [tasks, setTasks] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | 'completed' | 'all'
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Chat Bar Inline Attachment State
  const [attachedImages, setAttachedImages] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuAnim = useRef(new Animated.Value(0)).current;
  const plusRotateAnim = useRef(new Animated.Value(0)).current;

  // Detail Modal State (View All Attachments)
  const [selectedTask, setSelectedTask] = useState(null);

  // Edit Modal State (Triggered on Long Press)
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editImages, setEditImages] = useState([]);
  const [editFiles, setEditFiles] = useState([]);

  const textInputRef = useRef(null);

  // Keyboard Animation (shifts bottom input up above Samsung keyboard)
  const keyboardShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardOpen(true);
      const height = e?.endCoordinates?.height || 300;
      Animated.spring(keyboardShift, {
        toValue: -height + (Platform.OS === 'android' ? -8 : -14),
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
      Animated.spring(keyboardShift, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Theme Rotation Animation
  const themeRotateAnim = useRef(new Animated.Value(0)).current;

  // Sidebar Slide Animation
  const sidebarAnim = useRef(new Animated.Value(-400)).current;

  // Load Persisted Data
  useEffect(() => {
    (async () => {
      try {
        const storedTasks = await safeStorage.getItem(STORAGE_KEYS.TASKS);
        const storedTheme = await safeStorage.getItem(STORAGE_KEYS.THEME);

        if (storedTasks) setTasks(JSON.parse(storedTasks));
        if (storedTheme) setIsDark(storedTheme === 'dark');
      } catch (err) {
        console.error('Storage error:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Save Tasks
  useEffect(() => {
    if (loaded) {
      safeStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }, [tasks, loaded]);

  // Save Theme
  useEffect(() => {
    if (loaded) {
      safeStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    }
  }, [isDark, loaded]);

  // Sidebar toggle
  const toggleSidebar = (open) => {
    const target = open ? 0 : -sidebarWidth;
    setSidebarOpen(open);
    Animated.spring(sidebarAnim, {
      toValue: target,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  };

  // Theme Toggle Animation
  const toggleTheme = () => {
    Animated.sequence([
      Animated.timing(themeRotateAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(themeRotateAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    setIsDark((prev) => !prev);
  };

  const themeRotation = themeRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const plusRotation = plusRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Pick Images from Gallery
  const handlePickImage = async (isEditing = false) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || 'Bild',
        }));
        if (isEditing) {
          setEditImages((prev) => [...prev, ...picked]);
        } else {
          setAttachedImages((prev) => [...prev, ...picked]);
        }
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  // Pick Documents/Files
  const handlePickDocument = async (isEditing = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const newFile = {
          uri: doc.uri,
          name: doc.name || 'Dokument',
          size: doc.size,
        };
        if (isEditing) {
          setEditFiles((prev) => [...prev, newFile]);
        } else {
          setAttachedFiles((prev) => [...prev, newFile]);
        }
      }
    } catch (err) {
      console.warn('Doc picker error:', err);
    }
  };

  // Toggle Attachment Action Menu in Bottom Bar
  const toggleAttachMenu = () => {
    const nextVal = !showAttachMenu;
    setShowAttachMenu(nextVal);
    Animated.spring(attachMenuAnim, {
      toValue: nextVal ? 1 : 0,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
    Animated.spring(plusRotateAnim, {
      toValue: nextVal ? 1 : 0,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const closeAttachMenu = () => {
    if (showAttachMenu) {
      setShowAttachMenu(false);
      Animated.spring(attachMenuAnim, {
        toValue: 0,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }).start();
      Animated.spring(plusRotateAnim, {
        toValue: 0,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }).start();
    }
  };

  const pickInlineImage = async () => {
    closeAttachMenu();
    await handlePickImage(false);
  };

  const pickInlineDocument = async () => {
    closeAttachMenu();
    await handlePickDocument(false);
  };

  // Create Task directly from Chat Input Bar
  const handleCreateTask = () => {
    const trimmed = inputText.trim();
    if (!trimmed && attachedImages.length === 0 && attachedFiles.length === 0) return;
    const newTask = {
      id: Date.now().toString(),
      text: trimmed || (attachedImages.length > 0 ? 'Foto-Notiz' : 'Datei-Notiz'),
      completed: false,
      createdAt: new Date().toISOString(),
      images: attachedImages,
      files: attachedFiles,
    };
    setTasks((prev) => [newTask, ...prev]);
    setInputText('');
    setAttachedImages([]);
    setAttachedFiles([]);
    closeAttachMenu();
  };

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
    if (selectedTask && selectedTask.id === id) {
      setSelectedTask((prev) => ({ ...prev, completed: !prev.completed }));
    }
  };

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTask && selectedTask.id === id) {
      setSelectedTask(null);
    }
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  // Handle Long Press to Edit
  const handleLongPressTask = (task) => {
    setEditingTask(task);
    setEditTitle(task.text);
    setEditImages(task.images ? [...task.images] : []);
    setEditFiles(task.files ? [...task.files] : []);
  };

  // Save Edited Task
  const saveEditedTask = () => {
    if (!editingTask) return;
    const trimmed = editTitle.trim();
    if (trimmed) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                text: trimmed,
                images: editImages,
                files: editFiles,
              }
            : t
        )
      );
      if (selectedTask && selectedTask.id === editingTask.id) {
        setSelectedTask({
          ...selectedTask,
          text: trimmed,
          images: editImages,
          files: editFiles,
        });
      }
    }
    setEditingTask(null);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 350);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesFilter =
      filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed;
    const matchesSearch = t.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const activeCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayFormatted = new Date().toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <SafeAreaView style={[styles.safeArea, isDark ? styles.bgDark : styles.bgLight]}>
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#000000' : '#FFFFFF'} />

      {/* Top Header */}
      <View style={[styles.header, isDark ? styles.headerDark : styles.headerLight]}>
        <TouchableOpacity
          onPress={() => toggleSidebar(true)}
          style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
          activeOpacity={0.7}
        >
          <Feather name="menu" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerDate, isDark ? styles.subtextDark : styles.subtextLight]}>
            {todayFormatted}
          </Text>
          <Text style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
            {filter === 'all' ? 'Alle Aufgaben' : filter === 'completed' ? 'Erledigt' : 'Offene Aufgaben'}
          </Text>
        </View>

        {/* Theme Toggle Button: Icon Only, without Text */}
        <Animated.View style={{ transform: [{ rotate: themeRotation }] }}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
            activeOpacity={0.7}
          >
            {isDark ? (
              <Feather name="sun" size={20} color="#FFFFFF" />
            ) : (
              <Feather name="moon" size={20} color="#000000" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchPill, isDark ? styles.searchPillDark : styles.searchPillLight]}>
          <Feather name="search" size={18} color={isDark ? '#888888' : '#777777'} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Aufgaben durchsuchen..."
            placeholderTextColor={isDark ? '#777777' : '#999999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, isDark ? styles.textDark : styles.textLight]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Feather name="x" size={18} color={isDark ? '#888888' : '#777777'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Task List (Dismiss keyboard on tap outside input) */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <SwipeableTask
                item={item}
                isDark={isDark}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onPressTask={(task) => setSelectedTask(task)}
                onLongPressTask={handleLongPressTask}
                windowWidth={windowWidth}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              isKeyboardOpen && { paddingBottom: 380 },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, isDark ? styles.emptyCircleDark : styles.emptyCircleLight]}>
                  <Feather name="check-circle" size={36} color={isDark ? '#FFFFFF' : '#000000'} />
                </View>
                <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
                  {searchQuery ? 'Keine Treffer' : 'Alles erledigt!'}
                </Text>
                <Text style={[styles.emptySubtitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                  {searchQuery
                    ? 'Versuche einen anderen Suchbegriff.'
                    : 'Füge unten eine neue Aufgabe hinzu.'}
                </Text>
              </View>
            }
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Bottom Chat Input Bar with Inline Attachments and Floating Action Popover */}
      <Animated.View
        style={[
          styles.bottomBar,
          {
            transform: [{ translateY: keyboardShift }],
          },
        ]}
      >
        {/* Floating Attachments Menu Popover right above the bar */}
        {showAttachMenu && (
          <Animated.View
            style={[
              styles.attachMenuPopover,
              isDark ? styles.attachMenuDark : styles.attachMenuLight,
              {
                opacity: attachMenuAnim,
                transform: [
                  {
                    translateY: attachMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                  {
                    scale: attachMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              onPress={pickInlineImage}
              style={styles.attachMenuItem}
              activeOpacity={0.7}
            >
              <View style={[styles.attachIconCircle, isDark ? styles.attachIconDark : styles.attachIconLight]}>
                <Feather name="image" size={17} color={isDark ? '#000000' : '#FFFFFF'} />
              </View>
              <Text style={[styles.attachMenuText, isDark ? styles.textDark : styles.textLight]}>
                Bild
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.attachMenuDivider,
                isDark ? styles.attachMenuDividerDark : styles.attachMenuDividerLight,
              ]}
            />

            <TouchableOpacity
              onPress={pickInlineDocument}
              style={styles.attachMenuItem}
              activeOpacity={0.7}
            >
              <View style={[styles.attachIconCircle, isDark ? styles.attachIconDark : styles.attachIconLight]}>
                <Feather name="paperclip" size={17} color={isDark ? '#000000' : '#FFFFFF'} />
              </View>
              <Text style={[styles.attachMenuText, isDark ? styles.textDark : styles.textLight]}>
                Datei
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Live Attachments Preview directly docked above the text input inside the chat bar */}
        {(attachedImages.length > 0 || attachedFiles.length > 0) && (
          <View style={[styles.chatPreviewBar, isDark ? styles.chatPreviewBarDark : styles.chatPreviewBarLight]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chatPreviewScroll}
            >
              {attachedImages.map((img, idx) => (
                <View key={`chat-img-${idx}`} style={styles.chatThumbWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.chatThumbImage} />
                  <TouchableOpacity
                    onPress={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={styles.chatThumbDelete}
                    activeOpacity={0.8}
                  >
                    <Feather name="x" size={11} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {attachedFiles.map((f, idx) => (
                <View
                  key={`chat-file-${idx}`}
                  style={[styles.chatFileChip, isDark ? styles.chatFileChipDark : styles.chatFileChipLight]}
                >
                  <Feather name="file" size={14} color={isDark ? '#FFFFFF' : '#000000'} />
                  <Text
                    style={[styles.chatFileName, isDark ? styles.textDark : styles.textLight]}
                    numberOfLines={1}
                  >
                    {f.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* The Chat Input Pill */}
        <View style={[styles.inputPill, isDark ? styles.inputPillDark : styles.inputPillLight]}>
          {/* Plus Toggle Button (rotates 45 deg smoothly into an X) */}
          <TouchableOpacity
            onPress={toggleAttachMenu}
            style={[styles.attachToggleBtn, isDark ? styles.attachToggleDark : styles.attachToggleLight]}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
              <Feather name="plus" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </Animated.View>
          </TouchableOpacity>

          <TextInput
            ref={textInputRef}
            placeholder="Aufgabe schreiben..."
            placeholderTextColor={isDark ? '#777777' : '#999999'}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleCreateTask}
            returnKeyType="send"
            style={[styles.textInput, isDark ? styles.textDark : styles.textLight]}
          />

          {/* Send / Add Button */}
          <TouchableOpacity
            onPress={handleCreateTask}
            style={[
              styles.addButton,
              isDark ? styles.addButtonDark : styles.addButtonLight,
              (inputText.trim().length > 0 || attachedImages.length > 0 || attachedFiles.length > 0) &&
                (isDark ? styles.addButtonActiveDark : styles.addButtonActiveLight),
            ]}
            activeOpacity={0.8}
          >
            <Feather
              name={
                inputText.trim().length > 0 || attachedImages.length > 0 || attachedFiles.length > 0
                  ? 'arrow-up'
                  : 'plus'
              }
              size={20}
              color={isDark ? '#000000' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* =====================================================================
          FENSTER 2: Detail-Ansicht (Antippen einer Aufgabe)
          ===================================================================== */}
      <Modal visible={!!selectedTask} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailCard, isDark ? styles.detailCardDark : styles.detailCardLight]}>
            <View style={styles.sheetHeader}>
              <View style={[styles.statusBadge, selectedTask?.completed ? styles.statusBadgeCompleted : styles.statusBadgeActive]}>
                <Feather
                  name={selectedTask?.completed ? 'check' : 'circle'}
                  size={12}
                  color={selectedTask?.completed ? '#10B981' : '#888888'}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: selectedTask?.completed ? '#10B981' : isDark ? '#CCCCCC' : '#444444' },
                  ]}
                >
                  {selectedTask?.completed ? 'Erledigt' : 'Offen'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedTask(null)}
                style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={[styles.detailTitle, isDark ? styles.textDark : styles.textLight]}>
                {selectedTask?.text}
              </Text>

              {/* Images Preview in Detail View */}
              {selectedTask?.images && selectedTask.images.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Bilder ({selectedTask.images.length})
                  </Text>
                  <View style={styles.detailImagesGrid}>
                    {selectedTask.images.map((img, i) => (
                      <Image key={i} source={{ uri: img.uri }} style={styles.detailFullImage} resizeMode="cover" />
                    ))}
                  </View>
                </View>
              )}

              {/* Files List in Detail View */}
              {selectedTask?.files && selectedTask.files.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Angehängte Dateien ({selectedTask.files.length})
                  </Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {selectedTask.files.map((f, i) => (
                      <View
                        key={i}
                        style={[styles.detailFileChip, isDark ? styles.fileItemDark : styles.fileItemLight]}
                      >
                        <Feather name="file-text" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                        <Text
                          style={[styles.fileNameText, isDark ? styles.textDark : styles.textLight]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {(!selectedTask?.images || selectedTask.images.length === 0) &&
                (!selectedTask?.files || selectedTask.files.length === 0) && (
                  <Text style={[styles.noAttachmentsText, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Keine Bilder oder Dateien angehängt. (Länger gedrückt halten zum Bearbeiten)
                  </Text>
                )}

              {/* Actions inside Detail Card */}
              <View style={styles.detailActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (selectedTask) toggleTask(selectedTask.id);
                  }}
                  style={[styles.detailActionBtn, isDark ? styles.detailActionDark : styles.detailActionLight]}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={selectedTask?.completed ? 'rotate-ccw' : 'check'}
                    size={16}
                    color={isDark ? '#FFFFFF' : '#000000'}
                  />
                  <Text style={[styles.detailActionText, isDark ? styles.textDark : styles.textLight]}>
                    {selectedTask?.completed ? 'Wieder öffnen' : 'Als erledigt markieren'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (selectedTask) {
                      const t = selectedTask;
                      setSelectedTask(null);
                      handleLongPressTask(t);
                    }
                  }}
                  style={[styles.detailActionBtn, isDark ? styles.detailActionDark : styles.detailActionLight]}
                  activeOpacity={0.7}
                >
                  <Feather name="edit-2" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
                  <Text style={[styles.detailActionText, isDark ? styles.textDark : styles.textLight]}>
                    Bearbeiten
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =====================================================================
          FENSTER 3: Aufgabe bearbeiten (Langes Gedrückthalten)
          ===================================================================== */}
      <Modal visible={!!editingTask} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheetContainer, isDark ? styles.sheetDark : styles.sheetLight]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, isDark ? styles.textDark : styles.textLight]}>
                Aufgabe bearbeiten
              </Text>
              <TouchableOpacity
                onPress={() => setEditingTask(null)}
                style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                style={[styles.sheetInput, isDark ? styles.sheetInputDark : styles.sheetInputLight]}
                multiline
                autoFocus
              />

              {/* Attachments Actions for Editing */}
              <View style={styles.attachmentButtonsRow}>
                <TouchableOpacity
                  onPress={() => handlePickImage(true)}
                  style={[styles.attachButton, isDark ? styles.attachBtnDark : styles.attachBtnLight]}
                  activeOpacity={0.7}
                >
                  <Feather name="image" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                  <Text style={[styles.attachBtnText, isDark ? styles.textDark : styles.textLight]}>
                    Bild hinzufügen
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePickDocument(true)}
                  style={[styles.attachButton, isDark ? styles.attachBtnDark : styles.attachBtnLight]}
                  activeOpacity={0.7}
                >
                  <Feather name="paperclip" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                  <Text style={[styles.attachBtnText, isDark ? styles.textDark : styles.textLight]}>
                    Datei hinzufügen
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Image Previews in Edit */}
              {editImages.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={[styles.previewSectionTitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Bilder ({editImages.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {editImages.map((img, idx) => (
                      <View key={idx} style={styles.thumbWrapper}>
                        <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                        <TouchableOpacity
                          onPress={() => setEditImages((prev) => prev.filter((_, i) => i !== idx))}
                          style={styles.thumbDeleteBtn}
                          activeOpacity={0.8}
                        >
                          <Feather name="x" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* File Previews in Edit */}
              {editFiles.length > 0 && (
                <View style={styles.previewSection}>
                  <Text style={[styles.previewSectionTitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Dateien ({editFiles.length})
                  </Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {editFiles.map((f, idx) => (
                      <View
                        key={idx}
                        style={[styles.fileItemChip, isDark ? styles.fileItemDark : styles.fileItemLight]}
                      >
                        <Feather name="file" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
                        <Text
                          style={[styles.fileNameText, isDark ? styles.textDark : styles.textLight]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setEditFiles((prev) => prev.filter((_, i) => i !== idx))}
                          activeOpacity={0.7}
                        >
                          <Feather name="x" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                onPress={saveEditedTask}
                style={[styles.sheetSaveBtn, isDark ? styles.sheetSaveBtnDark : styles.sheetSaveBtnLight]}
                activeOpacity={0.85}
              >
                <Text style={[styles.sheetSaveText, isDark ? styles.sheetSaveTextDark : styles.sheetSaveTextLight]}>
                  Änderungen speichern
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sidebar (Drawer) with Rounded Corners per user rule */}
      {sidebarOpen && (
        <TouchableWithoutFeedback onPress={() => toggleSidebar(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.sidebar,
          isDark ? styles.sidebarDark : styles.sidebarLight,
          { width: sidebarWidth, transform: [{ translateX: sidebarAnim }] },
        ]}
      >
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarBrand}>
            <View style={[styles.brandDot, isDark ? styles.brandDotDark : styles.brandDotLight]} />
            <Text style={[styles.brandTitle, isDark ? styles.textDark : styles.textLight]}>
              Muzi To-Do
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleSidebar(false)}
            style={[styles.iconButton, isDark ? styles.iconButtonDark : styles.iconButtonLight]}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
        </View>

        {/* Progress Card */}
        <View style={[styles.sidebarCard, isDark ? styles.sidebarCardDark : styles.sidebarCardLight]}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, isDark ? styles.textDark : styles.textLight]}>
              Fortschritt
            </Text>
            <Text style={[styles.progressNumber, isDark ? styles.textDark : styles.textLight]}>
              {progressPercent}%
            </Text>
          </View>
          <View style={[styles.progressBarTrack, isDark ? styles.progressTrackDark : styles.progressTrackLight]}>
            <View
              style={[
                styles.progressBarFill,
                isDark ? styles.progressFillDark : styles.progressFillLight,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressSubtext, isDark ? styles.subtextDark : styles.subtextLight]}>
            {completedCount} von {totalCount} Aufgaben erledigt
          </Text>
        </View>

        {/* Navigation Filters */}
        <View style={styles.navSection}>
          <TouchableOpacity
            style={[
              styles.navItem,
              filter === 'active' && (isDark ? styles.navItemActiveDark : styles.navItemActiveLight),
            ]}
            onPress={() => {
              setFilter('active');
              toggleSidebar(false);
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="circle"
              size={18}
              color={
                filter === 'active'
                  ? isDark
                    ? '#000000'
                    : '#FFFFFF'
                  : isDark
                  ? '#FFFFFF'
                  : '#000000'
              }
            />
            <Text
              style={[
                styles.navText,
                filter === 'active'
                  ? isDark
                    ? styles.navTextActiveDark
                    : styles.navTextActiveLight
                  : isDark
                  ? styles.textDark
                  : styles.textLight,
              ]}
            >
              Offen
            </Text>
            <View
              style={[
                styles.navBadge,
                filter === 'active'
                  ? isDark
                    ? styles.navBadgeActiveDark
                    : styles.navBadgeActiveLight
                  : isDark
                  ? styles.navBadgeDark
                  : styles.navBadgeLight,
              ]}
            >
              <Text
                style={[
                  styles.navBadgeText,
                  filter === 'active'
                    ? isDark
                      ? styles.navBadgeTextActiveDark
                      : styles.navBadgeTextActiveLight
                    : isDark
                    ? styles.textDark
                    : styles.textLight,
                ]}
              >
                {activeCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navItem,
              filter === 'completed' && (isDark ? styles.navItemActiveDark : styles.navItemActiveLight),
            ]}
            onPress={() => {
              setFilter('completed');
              toggleSidebar(false);
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="check-circle"
              size={18}
              color={
                filter === 'completed'
                  ? isDark
                    ? '#000000'
                    : '#FFFFFF'
                  : isDark
                  ? '#FFFFFF'
                  : '#000000'
              }
            />
            <Text
              style={[
                styles.navText,
                filter === 'completed'
                  ? isDark
                    ? styles.navTextActiveDark
                    : styles.navTextActiveLight
                  : isDark
                  ? styles.textDark
                  : styles.textLight,
              ]}
            >
              Erledigt
            </Text>
            <View
              style={[
                styles.navBadge,
                filter === 'completed'
                  ? isDark
                    ? styles.navBadgeActiveDark
                    : styles.navBadgeActiveLight
                  : isDark
                  ? styles.navBadgeDark
                  : styles.navBadgeLight,
              ]}
            >
              <Text
                style={[
                  styles.navBadgeText,
                  filter === 'completed'
                    ? isDark
                      ? styles.navBadgeTextActiveDark
                      : styles.navBadgeTextActiveLight
                    : isDark
                    ? styles.textDark
                    : styles.textLight,
                ]}
              >
                {completedCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navItem,
              filter === 'all' && (isDark ? styles.navItemActiveDark : styles.navItemActiveLight),
            ]}
            onPress={() => {
              setFilter('all');
              toggleSidebar(false);
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="list"
              size={18}
              color={
                filter === 'all'
                  ? isDark
                    ? '#000000'
                    : '#FFFFFF'
                  : isDark
                  ? '#FFFFFF'
                  : '#000000'
              }
            />
            <Text
              style={[
                styles.navText,
                filter === 'all'
                  ? isDark
                    ? styles.navTextActiveDark
                    : styles.navTextActiveLight
                  : isDark
                  ? styles.textDark
                  : styles.textLight,
              ]}
            >
              Alle Aufgaben
            </Text>
            <View
              style={[
                styles.navBadge,
                filter === 'all'
                  ? isDark
                    ? styles.navBadgeActiveDark
                    : styles.navBadgeActiveLight
                  : isDark
                  ? styles.navBadgeDark
                  : styles.navBadgeLight,
              ]}
            >
              <Text
                style={[
                  styles.navBadgeText,
                  filter === 'all'
                    ? isDark
                      ? styles.navBadgeTextActiveDark
                      : styles.navBadgeTextActiveLight
                    : isDark
                    ? styles.textDark
                    : styles.textLight,
                ]}
              >
                {totalCount}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.navDivider} />

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              setShowWelcome(true);
              toggleSidebar(false);
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="info"
              size={18}
              color={isDark ? '#FFFFFF' : '#000000'}
            />
            <Text style={[styles.navText, isDark ? styles.textDark : styles.textLight]}>
              Willkommens-Screen
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sidebar Footer with Clear Completed */}
        <View style={styles.sidebarFooter}>
          {completedCount > 0 && (
            <TouchableOpacity
              onPress={clearCompleted}
              style={[styles.clearBtn, isDark ? styles.clearBtnDark : styles.clearBtnLight]}
              activeOpacity={0.7}
            >
              <Feather name="trash" size={16} color={isDark ? '#EF4444' : '#DC2626'} />
              <Text style={[styles.clearBtnText, { color: isDark ? '#EF4444' : '#DC2626' }]}>
                Erledigte leeren
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Willkommens-Bildschirm (Aesthetic Typography Manifesto wie in index.html) */}
      <Modal visible={showWelcome} animationType="fade" transparent={false}>
        <SafeAreaView style={[styles.welcomeContainer, isDark ? styles.bgDark : styles.bgLight]}>
          <ExpoStatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#000000' : '#FAFAFA'} />

          {/* Top Bar mit runder Schließen-Schaltfläche (wie in index.html) */}
          <View style={styles.welcomeTopBar}>
            <TouchableOpacity
              onPress={dismissWelcome}
              style={[
                styles.btnCloseWelcome,
                isDark ? styles.btnCloseWelcomeDark : styles.btnCloseWelcomeLight,
              ]}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          <View style={styles.aestheticWrapper}>
            <View style={styles.aestheticManifesto}>
              <Text style={[styles.aestheticGreeting, isDark ? styles.aestheticGreetingDark : styles.aestheticGreetingLight]}>
                Willkommen.
              </Text>
              <Text style={[styles.aestheticQuote, isDark ? styles.textDark : styles.textLight]}>
                „Fokus auf das Wesentliche.“
              </Text>
              <Text style={[styles.aestheticSubquote, isDark ? styles.subquoteDark : styles.subquoteLight]}>
                Deine täglichen Aufgaben klar strukturieren.
              </Text>
              <Text style={[styles.aestheticTertiary, isDark ? styles.subtextDark : styles.subtextLight]}>
                Schnelle Erfassung ohne Überfluss.
              </Text>
            </View>

            <TouchableOpacity
              onPress={dismissWelcome}
              style={[
                styles.btnStartAesthetic,
                isDark ? styles.btnStartAestheticDark : styles.btnStartAestheticLight,
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.btnStartAestheticText,
                  isDark ? styles.btnStartAestheticTextDark : styles.btnStartAestheticTextLight,
                ]}
              >
                {tasks.length > 0 ? 'Weiter zur App' : 'Jetzt starten'}
              </Text>
              <Feather
                name="arrow-right"
                size={20}
                color={isDark ? '#000000' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// =============================================================================
// Pure Black & White Round UI Styles (Strict adherence to user rule)
// =============================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  bgDark: {
    backgroundColor: '#000000',
  },
  bgLight: {
    backgroundColor: '#FAFAFA',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textLight: {
    color: '#000000',
  },
  subtextDark: {
    color: '#888888',
  },
  subtextLight: {
    color: '#777777',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 14,
  },
  headerDark: {
    backgroundColor: '#000000',
  },
  headerLight: {
    backgroundColor: '#FAFAFA',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDark: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  iconButtonLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 46,
  },
  searchPillDark: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#222222',
  },
  searchPillLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 4,
  },
  swipeRowContainer: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  trashBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  completeBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    zIndex: 2,
  },
  cardDark: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDEDED',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxBorderDark: {
    borderWidth: 2,
    borderColor: '#555555',
  },
  checkboxBorderLight: {
    borderWidth: 2,
    borderColor: '#CCCCCC',
  },
  checkboxCheckedDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkboxCheckedLight: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  taskTextWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  taskCompletedDark: {
    textDecorationLine: 'line-through',
    color: '#666666',
  },
  taskCompletedLight: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  attachmentBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  miniBadgeLight: {
    backgroundColor: '#F0F0F0',
  },
  miniBadgeDark: {
    backgroundColor: '#1E1E1E',
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCircleDark: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#282828',
  },
  emptyCircleLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
  },

  // Floating Action Popover for Attachments (+ Click)
  attachMenuPopover: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginLeft: 6,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  attachMenuDark: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
  },
  attachMenuLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 8,
  },
  attachIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachIconDark: {
    backgroundColor: '#FFFFFF',
  },
  attachIconLight: {
    backgroundColor: '#000000',
  },
  attachMenuText: {
    fontSize: 14,
    fontWeight: '700',
  },
  attachMenuDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  attachMenuDividerDark: {
    backgroundColor: '#333333',
  },
  attachMenuDividerLight: {
    backgroundColor: '#E5E5E5',
  },

  // Chat Attachments Live Preview Bar (Docked right above input pill)
  chatPreviewBar: {
    borderRadius: 20,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  chatPreviewBarDark: {
    backgroundColor: '#161616',
    borderColor: '#262626',
  },
  chatPreviewBarLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EFEFEF',
  },
  chatPreviewScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatThumbWrapper: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'visible',
  },
  chatThumbImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  chatThumbDelete: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#000000',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  chatFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 8,
    maxWidth: 160,
  },
  chatFileChipDark: {
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#333333',
  },
  chatFileChipLight: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chatFileName: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },

  // Bottom Input
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingLeft: 6,
    paddingRight: 6,
    height: 58,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  inputPillDark: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  inputPillLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  attachToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachToggleDark: {
    backgroundColor: '#222222',
  },
  attachToggleLight: {
    backgroundColor: '#F0F0F0',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDark: {
    backgroundColor: '#FFFFFF',
  },
  addButtonLight: {
    backgroundColor: '#000000',
  },
  addButtonActiveDark: {
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  addButtonActiveLight: {
    backgroundColor: '#000000',
    transform: [{ scale: 1.05 }],
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },

  // Modal Sheet (New Task & Edit Task)
  sheetContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  sheetDark: {
    backgroundColor: '#0E0E0E',
    borderTopWidth: 1,
    borderColor: '#222222',
  },
  sheetLight: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEEEEE',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetInput: {
    fontSize: 17,
    fontWeight: '500',
    minHeight: 80,
    borderRadius: 18,
    padding: 16,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  sheetInputLight: {
    backgroundColor: '#F7F7F7',
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  sheetInputDark: {
    backgroundColor: '#161616',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#282828',
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  attachButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
  },
  attachBtnLight: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  attachBtnDark: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  attachBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewSection: {
    marginBottom: 16,
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thumbWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  thumbImage: {
    width: 76,
    height: 76,
    borderRadius: 16,
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 10,
  },
  fileItemLight: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  fileItemDark: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  fileNameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  sheetSaveBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  sheetSaveBtnLight: {
    backgroundColor: '#000000',
  },
  sheetSaveBtnDark: {
    backgroundColor: '#FFFFFF',
  },
  sheetSaveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSaveTextLight: {
    color: '#FFFFFF',
  },
  sheetSaveTextDark: {
    color: '#000000',
  },

  // Detail Modal Card
  detailCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  detailCardDark: {
    backgroundColor: '#0E0E0E',
    borderTopWidth: 1,
    borderColor: '#222222',
  },
  detailCardLight: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEEEEE',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: '#262626',
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailImagesGrid: {
    gap: 12,
  },
  detailFullImage: {
    width: '100%',
    height: 220,
    borderRadius: 20,
  },
  detailFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    gap: 12,
  },
  noAttachmentsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 14,
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    gap: 8,
  },
  detailActionLight: {
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  detailActionDark: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  detailActionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 99,
  },

  // Sidebar with rounded corners per user rule
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 44,
    paddingHorizontal: 22,
    paddingBottom: 30,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  sidebarDark: {
    backgroundColor: '#0A0A0A',
    borderRightWidth: 1,
    borderColor: '#222222',
  },
  sidebarLight: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderColor: '#EBEBEB',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  brandDotDark: {
    backgroundColor: '#FFFFFF',
  },
  brandDotLight: {
    backgroundColor: '#000000',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Sidebar Progress Card
  sidebarCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  sidebarCardDark: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#242424',
  },
  sidebarCardLight: {
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressTrackDark: {
    backgroundColor: '#262626',
  },
  progressTrackLight: {
    backgroundColor: '#E0E0E0',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillDark: {
    backgroundColor: '#FFFFFF',
  },
  progressFillLight: {
    backgroundColor: '#000000',
  },
  progressSubtext: {
    fontSize: 12,
  },

  // Navigation Items
  navSection: {
    gap: 8,
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  navItemActiveDark: {
    backgroundColor: '#FFFFFF',
  },
  navItemActiveLight: {
    backgroundColor: '#000000',
  },
  navText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 14,
    flex: 1,
  },
  navTextActiveDark: {
    color: '#000000',
  },
  navTextActiveLight: {
    color: '#FFFFFF',
  },
  navBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  navBadgeDark: {
    backgroundColor: '#1E1E1E',
  },
  navBadgeLight: {
    backgroundColor: '#EFEFEF',
  },
  navBadgeActiveDark: {
    backgroundColor: '#E0E0E0',
  },
  navBadgeActiveLight: {
    backgroundColor: '#262626',
  },
  navBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  navBadgeTextActiveDark: {
    color: '#000000',
  },
  navBadgeTextActiveLight: {
    color: '#FFFFFF',
  },

  // Sidebar Footer
  sidebarFooter: {
    paddingTop: 16,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  clearBtnDark: {
    backgroundColor: '#1C1212',
    borderWidth: 1,
    borderColor: '#3D1C1C',
  },
  clearBtnLight: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  navDivider: {
    height: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    marginVertical: 10,
    marginHorizontal: 16,
  },

  // Willkommens-Bildschirm (Aesthetic Typography Manifesto wie in index.html)
  welcomeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  welcomeTopBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 6,
  },
  btnCloseWelcome: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCloseWelcomeDark: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
  },
  btnCloseWelcomeLight: {
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  aestheticWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: 30,
  },
  aestheticManifesto: {
    marginBottom: 44,
  },
  aestheticGreeting: {
    fontSize: 22,
    fontStyle: 'italic',
    fontFamily: 'serif',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  aestheticGreetingLight: {
    color: '#71717A',
  },
  aestheticGreetingDark: {
    color: '#A1A1AA',
  },
  aestheticQuote: {
    fontSize: 34,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: 'serif',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  aestheticSubquote: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 25,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  subquoteLight: {
    color: '#18181B',
  },
  subquoteDark: {
    color: '#F4F4F5',
  },
  aestheticTertiary: {
    fontSize: 15,
    lineHeight: 22,
  },
  btnStartAesthetic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 999,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  btnStartAestheticLight: {
    backgroundColor: '#000000',
  },
  btnStartAestheticDark: {
    backgroundColor: '#FFFFFF',
  },
  btnStartAestheticText: {
    fontSize: 17,
    fontWeight: '700',
  },
  btnStartAestheticTextLight: {
    color: '#FFFFFF',
  },
  btnStartAestheticTextDark: {
    color: '#000000',
  },
});
