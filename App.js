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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

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
// - Swipe RIGHT: Delete (Minimalist freestanding red trash icon)
// - Swipe LEFT: Toggle Completed (Minimalist freestanding check icon)
// - Tap Task: Edit inline
// =============================================================================
const SwipeableTask = ({
  item,
  isDark,
  onToggle,
  onDelete,
  windowWidth,
  isEditing,
  editingText,
  setEditingText,
  startEditing,
  saveEditing,
  cancelEditing,
}) => {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Only trigger on horizontal swipe when not editing
        if (isEditing) return false;
        return Math.abs(gesture.dx) > 12 && Math.abs(gesture.dy) < 15;
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 110) {
          // Swipe RIGHT -> Delete task
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
          // Swipe LEFT -> Mark as completed / Toggle completed
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

  // Red trash icon animation (swipe right)
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

  // Green checkmark icon animation (swipe left)
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

  return (
    <View style={styles.swipeRowContainer}>
      {/* Freistehendes rotes Mülleimer-Icon (links, beim Nach-Rechts-Wischen) */}
      <View style={styles.trashBackground}>
        <Animated.View style={{ transform: [{ scale: trashScale }], opacity: trashOpacity }}>
          <Feather name="trash-2" size={24} color="#EF4444" />
        </Animated.View>
      </View>

      {/* Freistehendes Erledigt-Icon (rechts, beim Nach-Links-Wischen) */}
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

        {/* Task Content: Inline Editing or Text Display */}
        {isEditing ? (
          <View style={styles.inlineEditWrapper}>
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              onSubmitEditing={saveEditing}
              returnKeyType="done"
              autoFocus
              style={[styles.inlineEditInput, isDark ? styles.textDark : styles.textLight]}
            />
            <TouchableOpacity
              onPress={saveEditing}
              style={[styles.editActionBtn, isDark ? styles.editSaveBtnDark : styles.editSaveBtnLight]}
              activeOpacity={0.8}
            >
              <Feather name="check" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={cancelEditing}
              style={[styles.editActionBtn, isDark ? styles.editCancelBtnDark : styles.editCancelBtnLight]}
              activeOpacity={0.8}
            >
              <Feather name="x" size={16} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.taskTextWrapper}
            onPress={() => startEditing(item)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.taskTitle,
                isDark ? styles.textDark : styles.textLight,
                item.completed && (isDark ? styles.taskCompletedDark : styles.taskCompletedLight),
              ]}
            >
              {item.text}
            </Text>
            <Feather
              name="edit-2"
              size={13}
              color={isDark ? '#444444' : '#BBBBBB'}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Edit Task State
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');

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
        const storedWelcome = await safeStorage.getItem(STORAGE_KEYS.WELCOME);

        if (storedTasks) setTasks(JSON.parse(storedTasks));
        if (storedTheme) setIsDark(storedTheme === 'dark');
        if (!storedWelcome) setShowWelcome(true);
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

  // Task Operations
  const addTask = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    const newTask = {
      id: Date.now().toString(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    setInputText('');
  };

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  // Edit Task handlers
  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
  };

  const saveEditing = () => {
    if (!editingTaskId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTaskId ? { ...t, text: trimmed } : t))
      );
    }
    setEditingTaskId(null);
    setEditingText('');
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingText('');
  };

  const dismissWelcome = async () => {
    await safeStorage.setItem(STORAGE_KEYS.WELCOME, 'true');
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
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          if (editingTaskId) cancelEditing();
        }}
        accessible={false}
      >
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
                windowWidth={windowWidth}
                isEditing={editingTaskId === item.id}
                editingText={editingText}
                setEditingText={setEditingText}
                startEditing={startEditing}
                saveEditing={saveEditing}
                cancelEditing={cancelEditing}
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

      {/* Bottom Task Input Bar (Animated with keyboardShift for Samsung Keyboard) */}
      <Animated.View
        style={[
          styles.bottomBar,
          {
            transform: [{ translateY: keyboardShift }],
          },
        ]}
      >
        <View style={[styles.inputPill, isDark ? styles.inputPillDark : styles.inputPillLight]}>
          <TextInput
            ref={textInputRef}
            placeholder="Neue Aufgabe..."
            placeholderTextColor={isDark ? '#777777' : '#999999'}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={addTask}
            returnKeyType="done"
            style={[styles.textInput, isDark ? styles.textDark : styles.textLight]}
          />
          <TouchableOpacity
            onPress={addTask}
            style={[styles.addButton, isDark ? styles.addButtonDark : styles.addButtonLight]}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={20} color={isDark ? '#000000' : '#FFFFFF'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

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
          <View style={styles.aestheticWrapper}>
            <View style={styles.aestheticManifesto}>
              <Text style={[styles.aestheticGreeting, isDark ? styles.aestheticGreetingDark : styles.aestheticGreetingLight]}>
                Willkommen.
              </Text>
              <Text style={[styles.aestheticQuote, isDark ? styles.textDark : styles.textLight]}>
                "Fokus auf das Wesentliche."
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
    flex: 1,
  },
  taskCompletedDark: {
    textDecorationLine: 'line-through',
    color: '#666666',
  },
  taskCompletedLight: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },

  // Inline Editing
  inlineEditWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineEditInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#888888',
  },
  editActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnLight: {
    backgroundColor: '#000000',
  },
  editSaveBtnDark: {
    backgroundColor: '#FFFFFF',
  },
  editCancelBtnLight: {
    backgroundColor: '#EEEEEE',
  },
  editCancelBtnDark: {
    backgroundColor: '#262626',
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
    paddingLeft: 20,
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
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
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

  // Willkommens-Bildschirm (Aesthetic Typography Manifesto wie in index.html)
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  aestheticWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  aestheticManifesto: {
    marginBottom: 44,
  },
  aestheticGreeting: {
    fontSize: 22,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
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
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
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
