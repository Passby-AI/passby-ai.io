---
title: cg中的浮点数问题
tags:
  - floating-point
  - epsilon
  - numerical-stability
  - ray-tracing
  - cpp
categories:
  - 计算机图形学
  - 数值计算
aliases: []
created: 2026-07
draft: false
slug: cg中的浮点数问题
status: archived
---
简单来说，**直接用来比较两个浮点数是否相等是极其危险的，因为计算机无法精确地表示所有小数。** 使用一个极小值 `epsilon` 就是为了将“绝对相等”的判断，变成“在可接受的误差范围内，我们认为它们相等”的判断。

下面我为详细拆解这个过程。

### 1. 问题的根源：浮点数的“不精确”表示

* 在计算机内部，数字是用二进制（0和1）存储的。整数（如 1, 10, -5）可以被精确地表示。但是，很多我们常见的小数（如 0.1, 0.3）在二进制中是无限循环的，就像十进制中的 1/3 = 0.3333... 一样。

* 计算机的内存是有限的，所以它必须在某个点截断这个无限循环的二进制小数。这个截断过程就会引入一个微小的、几乎无法避免的**舍入误差 (Rounding Error)**。

* **一个经典的例子：**

```c++
#include <iostream>
#include <iomanip> // 用于设置输出精度

int main() {
    double a = 0.1;
    double b = 0.2;
    double sum = a + b;

    std::cout << std::setprecision(20); // 显示更多小数位
    std::cout << "a + b = " << sum << std::endl;
    
    if (sum == 0.3) {
        std::cout << "sum is equal to 0.3" << std::endl;
    } else {
        std::cout << "sum is NOT equal to 0.3" << std::endl;
    }

    return 0;
}
```

当运行这段代码，会惊讶地发现输出是：

```bash
a + b = 0.30000000000000004441
sum is NOT equal to 0.3
```

看到了吗？在数学上 `0.1 + 0.2` 明明等于 `0.3`，但在计算机的浮点数世界里，由于舍入误差，结果是一个极其接近 `0.3` 但又不完全相等的数。因此，`sum == 0.3` 的判断失败了。

### 2. Epsilon 如何解决这个问题

* `Epsilon` (ε) 是一个我们自己定义的、非常小的正数（例如 `1e-8`，即 `0.00000001`）。我们用它来建立一个“可容忍的误差范围”。

* 我们不再问：“`A` 和 `B` 是否**完全相等**？”，而是问：“`A` 和 `B` 之间的差距是否**小到可以忽略不计**？”

* 这个新的判断逻辑可以写成：`abs(A - B) < epsilon`

* **回到光线追踪的例子中：**

* 在 `trangle.h` 的 `Hit` 函数中，我们需要判断光线是否与三角形所在的平面平行。在几何上，这意味着光线的方向向量 `Direction` 与平面的法向量 `NormalVector` 是垂直的。在数学上，这意味着它们的点积（Dot Product）**正好为 0**。

C++

```c++
const auto Denominator = Dot(NormalVector, Light.RayDirection());
```

* **理想情况 (数学世界)**：如果光线平行于平面，`Denominator` 的值会是 **精确的 0.0**。

* **实际情况 (计算机世界)**：由于浮点数精度问题，经过一系列乘法和加法后，`Denominator` 的值很可能是 `0.00000000000000012` 或者 `-0.00000000000000009` 这样极其接近零的数字。

**如果我们这样做：**

C++

```
// 错误的做法
if (Denominator == 0.0) {
    return false; // 认为光线平行，不相交
}
```

这个判断很可能会失败！计算机会认为 `0.00000000000000012` 不等于 `0.0`，然后继续执行下面的除法运算 `Root = Numerator / Denominator`。用一个数去除以一个极小的数，会得到一个巨大的、无意义的结果，导致渲染出现错误（比如在很远的地方出现一个错误的像素点）。

**正确的做法是使用 Epsilon：**

C++

```
// 正确的做法
const double epsilon = 1e-8;
if (std::abs(Denominator) < epsilon) {
    return false; // 在误差范围内，我们认为光线就是平行的
}
```

这行代码的意思是：“如果 `Denominator` 的绝对值小于 `0.00000001`，我们就认为它实际上就是 0，光线与平面平行，不相交”。这样就完美地避开了浮点数精度问题带来的陷阱。

### 总结

* **问题**：计算机浮点数运算存在微小的舍入误差，导致本应为 0 的结果变成了极小的非零数。

* **风险**：直接使用 `== 0.0` 进行判断会失败，可能导致后续的除零错误或产生巨大的无效数值。

* **解决方案**：引入一个极小值 `epsilon` 作为误差容忍度，将 `x == 0` 的判断替换为 `abs(x) < epsilon`，从而使比较变得稳健（robust），能够正确处理那些“几乎为零”的情况。”。

### 核心思想：从“精确”到“容错”

* 需要转变一个核心思维：在浮点数的世界里，几乎不存在绝对的“等于”。我们追求的不是数学上的精确，而是“**在可接受的误差范围内的足够精确**”。所用的 `epsilon` 方法，正是这种思维的体现。

***

### 推荐学习资源

#### 1. 视频资源 (从概念到实践)

* **\[必看] "浮点数是如何工作的 (可视化)" by Computerphile**

  * **链接**: [Floating Point Numbers - Computerphile](https://www.youtube.com/watch?v=PZRI1IfStY0)

  * **简介**: 这是理解浮点数内部存储原理（IEEE 754 标准）的绝佳入门视频。它用非常直观的方式解释了为什么 `0.1 + 0.2 != 0.3`。看完这个，会从根本上理解问题的来源。虽然是英文视频，但内容非常经典，建议打开自动翻译字幕观看。

* **\[游戏开发视角] "C++ 游戏引擎中的浮点数精度" by The Cherno**

  * **链接**: The Cherno 的频道经常会谈及这类底层问题，虽然没有专门一期视频叫这个名字，但在他的《游戏引擎系列》中，尤其是在实现向量、矩阵和物理运算时，会反复强调和处理这些精度问题。

  * **学习方法**: 观看他的游戏引擎系列，特别留意他是如何进行向量比较、如何处理物理碰撞中的微小重叠等。他的代码风格和实践非常有参考价值。**[The Cherno C++ Game Engine Series](https://www.google.com/search?q=https://www.youtube.com/playlist%3Flist%3DPLlrATfBNZ98dC-V-N3m0Go4dIqtCgj75D)**

* **\[深入探讨] "游戏开发中的数值稳定性" (GDC 演讲)**

  * **链接**: 在 GDC (Game Developers Conference) 的官方频道上搜索 "numerical stability" 或 "floating point" 可以找到很多资深从业者的分享。

  * **简介**: 这些演讲通常会深入探讨一些更复杂的情况，比如物理模拟中的累积误差、在大型世界场景中（远离原点）的精度损失问题（这是光线追踪进阶后会遇到的）等。

#### 2. GitHub 项目与代码实践

* 在项目中学习是巩固知识最好的方式。

* **GLM (OpenGL Mathematics) 库源码**

  * <https://github.com/g-truc/glm>

  * 一个在图形学领域被广泛使用的 C++ 数学库，专门用于处理向量和矩阵。

  * **学习方法**:

    1. **看 `epsilon` 的实现**: 搜索 `epsilonEqual` 或类似函数，看看一个工业级的库是如何实现浮点数比较的。会发现它不仅用了 `epsilon`，还可能考虑了相对误差。

    2. **阅读函数的实现**: 查看 `inverse` (求逆矩阵), `normalize` (单位化向量) 等函数的实现。这些函数通常需要处理除以一个可能接近零的数（比如向量的长度）的情况，是学习稳健性编程的绝佳范例。

* **PhysX 物理引擎源码**
  * <https://github.com/NVIDIAGameWorks/PhysX>

  * 这是一个专业的、开源的物理引擎。物理模拟是浮点数误差的“重灾区”，因此它的代码里充满了处理这些问题的智慧。

  * 这个项目比较庞大，可以重点关注：

    1. **碰撞检测 (Collision Detection)** 部分的代码。看看它是如何判断两个物体是否“接触”的，这必然会用到带容差的比较。

    2. **约束求解器 (Constraint Solver)** 部分。看看它是如何处理微小的穿透和位置修正的。

#### 3. 权威文章

* **\[圣经级文章] What Every Computer Scientist Should Know About Floating-Point Arithmetic**

  * <https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html>

  * 这篇文章是这个领域的奠基之作。它非常长，也非常理论化，可能有些枯燥。但如果真的想成为这个领域的专家，它是绕不开的。

  * 不用一次性读完。可以先看视频建立直观理解，然后在实践中遇到 конкретны (specific) 的问题时，再回过头来查阅这篇文章的相关章节。

***

### 总结：如何培养处理浮点数问题的直觉？

* 在学习以上资源的同时，可以刻意在自己的项目中培养以下几个习惯：

1. **建立“危险操作”雷达**：一看到以下操作，就要立刻拉响警报，思考精度问题：

   * **浮点数相等性比较 (`==`)**: 这是最高警报。立即用 `epsilon` 替换。

   * **除法 (`/`)**: 时刻问自己：“分母可能为零或接近零吗？”

   * **减法 (`-`)**: 警惕“**灾难性抵消 (Catastrophic Cancellation)**”，即两个非常接近的数字相减，会导致有效精度大量丢失。

   * **开方 (`sqrt`) 和 `acos`**: 确保输入参数永远不会是负数（即使由于误差变成了 `-1e-9` 这样微小的负数）。

   * **累加/累减**: 在循环中反复加/减一个很小的数到一个很大的数上，会导致精度丢失。

2. 封装的比较函数：

   * 不要在代码里到处写 abs(a - b) < 0.00001。应该在的工具类或 rtweekend.h 中定义一个全局的、稳健的比较函数。

   ```c++
   // 在 rtweekend.h 或一个工具头文件中
   #include <cmath>
   #include <limits>

   inline bool approximately(double a, double b, double epsilon = std::numeric_limits<double>::epsilon()) {
       return std::abs(a - b) <= epsilon;
   }

   // 一个更稳健的版本，考虑了相对误差
   inline bool robust_approximately(double a, double b, double rel_epsilon = 1e-8, double abs_epsilon = 1e-8) {
       if (a == b) return true;
       if (std::isinf(a) || std::isinf(b)) return false;
       return std::abs(a - b) <= std::max(abs_epsilon, rel_epsilon * std::max(std::abs(a), std::abs(b)));
   }
   ```

3. **调试时打印原始值**：当渲染结果出现奇怪的噪点、黑斑或“NaN”（Not a Number）像素时，找到对应的光线，然后一步步打印出的计算中间值，特别是那些“危险操作”的结果。通常很快就能定位到是哪个计算环节出现了问题。
